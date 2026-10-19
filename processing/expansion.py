"""Private batch preflight and gated per-cell built-area differences. Never infers a GHSL model."""
from __future__ import annotations
import argparse
from copy import deepcopy
import hashlib
import json
import re
import math
from shapely.geometry import shape
from pathlib import Path
from .spatial import project_features, finite_number, record_id

OFFICIAL = frozenset(('JRZ','CHH','SLT','TOR','MTY','HMO','OBR','MXL','TIJ','GDL','QRO','VER','LEO','PUE','TOL','CAN','SLP','AGS'))
CHECKOUT = Path(__file__).resolve().parents[1]

def private_path(value):
    path=Path(value).expanduser().resolve()
    if path==CHECKOUT or CHECKOUT in path.parents:
        raise ValueError('Entradas y resultados deben estar fuera del checkout público')
    return path

def read_original(path):
    def pairs(items):
        result={}
        for key,value in items:
            if key in result: raise ValueError('Claves JSON duplicadas')
            result[key]=value
        return result
    data=path.read_bytes()
    return json.loads(data,object_pairs_hook=pairs,parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Número no finito'))),hashlib.sha256(data).hexdigest()

def audit_job(job, *, compute=False):
    if job.get('plaza') not in OFFICIAL: raise ValueError('Plaza no oficial')
    profile=deepcopy(job['profile'])
    if profile.get('method')!='per-cell-built-area-delta':
        raise ValueError('Método no soportado/verificado. Huellas poligonales no equivalen a superficie construida por celda')
    if profile.get('units')!='m2': raise ValueError('Unidades originales m2 requeridas; no se infieren ni convierten')
    threshold=finite_number(profile['threshold_m2'],'umbral',minimum=0)
    if threshold<=0: raise ValueError('Umbral documentado positivo requerido')
    epochs=profile['epochs']
    for year in ('2015','2025'):
        e=epochs[year]
        if e.get('year')!=int(year) or e.get('nature') not in ('historical-model','estimate','projection','observed') or not e.get('source') or not e.get('product') or not e.get('version'):
            raise ValueError('Procedencia, versión y naturaleza temporal explícitas requeridas para ambos periodos')
    if epochs['2025']['nature']=='observed':
        raise ValueError('2025 no se admite como observación certificada en este pipeline GHSL')
    if epochs['2015']['product']!=epochs['2025']['product'] or epochs['2015']['version']!=epochs['2025']['version']:
        raise ValueError('Productos/versiones no comparables sin un procedimiento de armonización verificado')
    if not profile.get('grid_reference') or not profile.get('comparability_reference'):
        raise ValueError('Faltan evidencia de alineación de malla y comparabilidad temporal')
    data=[]; hashes=[]; records=[]
    for year in ('2015','2025'):
        original,digest=read_original(private_path(job['inputs'][year]));data.append(original);hashes.append(digest)
    if profile['metric_crs']=='auto-utm':
        if profile['source_crs']!='EPSG:4326':raise ValueError('UTM automático requiere entradas WGS84 explícitas')
        bounds=[shape(f['geometry']).bounds for collection in data for f in collection['features']]
        if not bounds:raise ValueError('No hay celdas para proponer CRS UTM')
        west=min(b[0] for b in bounds);east=max(b[2] for b in bounds);south=min(b[1] for b in bounds);north=max(b[3] for b in bounds)
        if south<0<north:raise ValueError('Se cruzan hemisferios; se requiere una proyección revisada')
        zone=math.floor(((west+east)/2+180)/6)+1
        if not 1<=zone<=60:raise ValueError('Zona UTM fuera de rango')
        profile['metric_crs']='EPSG:'+str((32600 if south>=0 else 32700)+zone)
        profile['crs_selection']='Zona UTM por extensión conjunta; project_features comprueba todo el ámbito de uso, sin fallback.'
    for original in data:
        records.append(project_features(original,source_crs=profile['source_crs'],metric_crs=profile['metric_crs'],id_field=profile['id_field']))
    if not records[0] or not records[1]:raise ValueError('Sin celdas: no se genera una integración vacía')
    index=[{(type(r.attributes[profile['id_field']]).__name__,r.id):r for r in group} for group in records]
    if set(index[0])!=set(index[1]): raise ValueError('IDs distintos entre periodos: no se convierten ausencias en cero')
    quality={'cells':len(records[0]),'null_or_missing':0,'positive_delta':0,'above_threshold':0,'negative_delta':0,'temporal_nature_2025':epochs['2025']['nature'],'certified':False}
    deltas={}
    for key,before in index[0].items():
        after=index[1][key]
        if before.geometry.geom_type not in ('Polygon','MultiPolygon') or before.geometry.area<=0 or not before.geometry.equals_exact(after.geometry,0):
            raise ValueError('Se requieren las mismas celdas poligonales, sin reparación ni realineación silenciosa')
        values=[before.attributes.get(profile['area_fields']['2015']),after.attributes.get(profile['area_fields']['2025'])]
        if any(v is None for v in values): quality['null_or_missing']+=1;continue
        values=[finite_number(v,'superficie construida',minimum=0) for v in values]
        if any(v>before.geometry.area for v in values): raise ValueError('Superficie construida excede el área geométrica de la celda; revisar unidades y soporte')
        if not compute:continue
        delta=values[1]-values[0];deltas[key]=delta
        quality['negative_delta']+=int(delta<0);quality['positive_delta']+=int(delta>0);quality['above_threshold']+=int(delta>=threshold)
    return profile,data,hashes,quality,deltas

def run_job(job,*,execute=False):
    # Audit does not compute/export new territorial deltas until documentary approval is present.
    profile=job['profile'];verification=profile.get('verification',{})
    if execute and (verification.get('status')!='reviewed' or not verification.get('reviewer') or not re.fullmatch(r'[0-9a-f]{64}',verification.get('document_sha256',''))):
        raise ValueError('Ejecución bloqueada: falta revisión documental explícita, revisor y SHA-256 de evidencia')
    if execute and hashlib.sha256(private_path(verification['document_path']).read_bytes()).hexdigest()!=verification['document_sha256']:
        raise ValueError('Huella del documento de revisión incorrecta')
    profile,data,hashes,quality,deltas=audit_job(job,compute=execute)
    evidence={'plaza':job['plaza'],'mode':'execute' if execute else 'audit-only','source_sha256':dict(zip(('2015','2025'),hashes)),'quality':quality,'method':profile['method'],'profile':deepcopy(profile),'certified':False}
    if not execute:
        # Keep audit about technical readiness, not territorial findings.
        for field in ('positive_delta','above_threshold','negative_delta'):quality.pop(field,None)
        return evidence
    if profile.get('approved_input_sha256')!=evidence['source_sha256']:
        raise ValueError('La aprobación no corresponde a estas entradas exactas')
    outputs={name:{'type':'FeatureCollection','features':[]} for name in ('positive','threshold')}
    before_by_id={(type(f['properties'][profile['id_field']]).__name__,record_id(f['properties'][profile['id_field']])):f for f in data[0]['features']}
    for feature in data[1]['features']:
        raw=feature['properties'][profile['id_field']];key=(type(raw).__name__,record_id(raw));delta=deltas.get(key)
        if delta is None or delta<=0:continue
        result=deepcopy(feature)
        # Nested, collision-free provenance wrapper; never overwrites an original attribute.
        result['properties']={'original_2015':deepcopy(before_by_id[key]['properties']),'original_2025':deepcopy(feature['properties']),'derived':{'delta_built_m2':delta,'threshold_m2':profile['threshold_m2'],'nature_2025':profile['epochs']['2025']['nature'],'certified':False}}
        outputs['positive']['features'].append(result)
        if delta>=profile['threshold_m2']: outputs['threshold']['features'].append(deepcopy(result))
    # Export in WGS84 only; projected-source export needs an explicit, separate transformation.
    if profile['source_crs']!='EPSG:4326': raise ValueError('Exportación GeoJSON requiere entrada WGS84 explícita')
    root=private_path(job['output']);root.mkdir(parents=True,exist_ok=False,mode=0o700)
    for name,collection in {**outputs,'provenance':evidence}.items():
        path=root/(name+'.json' if name=='provenance' else name+'.geojson');path.write_text(json.dumps(collection,ensure_ascii=False,allow_nan=False));path.chmod(0o600)
    return evidence

def expand_jobs(plan):
    common=plan.get('shared_profile',{})
    if 'jobs' in plan:
        return [{**job,'profile':{**deepcopy(common),**deepcopy(job.get('profile',{}))}} for job in plan['jobs']]
    root=private_path(plan['input_root']);patterns=plan['input_patterns'];jobs=[]
    for plaza in sorted(OFFICIAL):
        def expand(pattern):return pattern.replace('{CODE}',plaza).replace('{code}',plaza.lower())
        inputs={year:str(root/expand(patterns[year])) for year in ('2015','2025')}
        jobs.append({'plaza':plaza,'inputs':inputs,'output':str(private_path(plan['output_root'])/plaza),'profile':deepcopy(common)})
    return jobs

def run_batch(plan,*,execute=False):
    results=[]
    for job in expand_jobs(plan):
        try:results.append({'plaza':job.get('plaza'),'status':'passed',**run_job(job,execute=execute)})
        except (ValueError,KeyError,TypeError,OSError) as error:results.append({'plaza':job.get('plaza'),'status':'blocked','reason':str(error),'certified':False})
    return results

def main():
    parser=argparse.ArgumentParser();parser.add_argument('plan');parser.add_argument('report');parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    plan,_=read_original(private_path(args.plan));results=run_batch(plan,execute=args.execute)
    report=private_path(args.report)
    with report.open('x',encoding='utf8') as stream:json.dump({'results':results,'certified':False},stream,ensure_ascii=False,allow_nan=False,indent=2)
    report.chmod(0o600)
    if any(r['status']=='blocked' for r in results):raise SystemExit(2)

if __name__=='__main__':main()
