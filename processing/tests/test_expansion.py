import unittest,json,tempfile,hashlib
from pathlib import Path
from processing.expansion import run_job

class ExpansionTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='arec-v13-synthetic-');self.root=Path(self.tmp.name)
  def fc(value):return {'type':'FeatureCollection','features':[{'type':'Feature','properties':{'cell_id':'synthetic','built':value,'nullable':None},'geometry':{'type':'Polygon','coordinates':[[[-106.425,31.69],[-106.42,31.69],[-106.42,31.695],[-106.425,31.695],[-106.425,31.69]]]}}]}
  self.fc=fc
  for year,value in [('2015',1000),('2025',21000)]: (self.root/(year+'.json')).write_text(json.dumps(fc(value)))
  epochs={year:{'year':int(year),'nature':'historical-model' if year=='2015' else 'estimate','source':'synthetic','product':'synthetic','version':'test'} for year in ('2015','2025')}
  self.job={'plaza':'JRZ','inputs':{y:str(self.root/(y+'.json')) for y in ('2015','2025')},'output':str(self.root/'out'),'profile':{'method':'per-cell-built-area-delta','units':'m2','threshold_m2':20000,'epochs':epochs,'source_crs':'EPSG:4326','metric_crs':'EPSG:32613','id_field':'cell_id','area_fields':{'2015':'built','2025':'built'},'grid_reference':'synthetic','comparability_reference':'synthetic'}}
 def tearDown(self): self.tmp.cleanup()
 def approve(self):
  doc=self.root/'review.txt';doc.write_text('Synthetic test approval, no corporate method')
  self.job['profile']['verification']={'status':'reviewed','reviewer':'synthetic-test','document_path':str(doc),'document_sha256':hashlib.sha256(doc.read_bytes()).hexdigest()}
  self.job['profile']['approved_input_sha256']={y:hashlib.sha256(Path(p).read_bytes()).hexdigest() for y,p in self.job['inputs'].items()}
 def test_default_audit_produces_no_results(self):
  result=run_job(self.job);self.assertFalse(result['certified']);self.assertNotIn('above_threshold',result['quality']);self.assertFalse((self.root/'out').exists())
 def test_execution_gated_and_boundary_inclusive(self):
  with self.assertRaises(ValueError):run_job(self.job,execute=True)
  self.approve();r=run_job(self.job,execute=True);self.assertEqual(r['quality']['above_threshold'],1)
  f=json.loads((self.root/'out/threshold.geojson').read_text())['features'][0];self.assertEqual(f['properties']['derived']['delta_built_m2'],20000);self.assertIsNone(f['properties']['original_2025']['nullable']);self.assertFalse(f['properties']['derived']['certified'])
 def test_nulls_never_become_zero(self):
  (self.root/'2025.json').write_text(json.dumps(self.fc(None)));self.approve();r=run_job(self.job,execute=True);self.assertEqual(r['quality']['null_or_missing'],1);self.assertEqual(json.loads((self.root/'out/positive.geojson').read_text())['features'],[])
 def test_rejects_temporal_crs_ids_and_unverified_algorithm(self):
  self.job['profile']['epochs']['2025']['nature']='observed'
  with self.assertRaises(ValueError):run_job(self.job)
  self.job['profile']['epochs']['2025']['nature']='estimate';self.job['profile']['method']='polygon-difference'
  with self.assertRaises(ValueError):run_job(self.job)
 def test_changed_inputs_invalidate_approval(self):
  self.approve();(self.root/'2025.json').write_text(json.dumps(self.fc(22000)))
  with self.assertRaises(ValueError):run_job(self.job,execute=True)
  self.assertFalse((self.root/'out').exists())
 def test_shared_plan_expands_all_plazas_and_auto_utm_is_not_pinned_to_jrz(self):
  from processing.expansion import expand_jobs,run_batch
  plan={'input_root':str(self.root),'output_root':str(self.root/'outputs'),'input_patterns':{'2015':'{CODE}/old.json','2025':'{CODE}/new.json'},'shared_profile':self.job['profile']}
  self.assertEqual(len(expand_jobs(plan)),18)
  self.job['profile']['metric_crs']='auto-utm';r=run_job(self.job);self.assertEqual(r['profile']['metric_crs'],'EPSG:32613');self.assertEqual(self.job['profile']['metric_crs'],'auto-utm')
  bad={**self.job,'plaza':'DEL'};results=run_batch({'shared_profile':self.job['profile'],'jobs':[bad,self.job]});self.assertEqual([r['status'] for r in results],['blocked','passed'])
