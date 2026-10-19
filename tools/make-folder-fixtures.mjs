// Reproducible synthetic fixtures only, always outside the public checkout.
import {mkdir,writeFile,open} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {PLAZAS} from '../src/plazas.js';
const root=resolve(process.argv[2]||'/tmp/arec-phase-fixtures');const repo=resolve(import.meta.dirname,'..');
if(root===repo||root.startsWith(repo+sep))throw Error('Fixtures must stay outside the checkout.');
await mkdir(root,{recursive:false,mode:0o700});
const codes=Object.keys(PLAZAS);
const polygon={type:'Polygon',coordinates:[[[-106.427,31.688],[-106.422,31.688],[-106.422,31.693],[-106.427,31.693],[-106.427,31.688]]]};
const feature=(id,geometry=polygon)=>({type:'Feature',properties:{cell_id:id,nullable:null,zero:0},geometry});
const collection=features=>({type:'FeatureCollection',features});
async function put(path,value){const file=resolve(root,path);await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,value,{mode:0o600});}
function reference(phase=false){
 const variables=Array.from({length:23},(_,i)=>({id:i+1,nombre:'Synthetic V'+(i+1),subcapas:!phase||i===8?[{id:'synthetic_v'+String(i+1).padStart(2,'0'),nombre:'Synthetic source '+(i+1)}]:[]}));
 const routes={},colors={},methods={};
 for(const v of variables)for(const sub of v.subcapas){routes[sub.id]=`../data/{CODE}/evidence/V${String(v.id).padStart(2,'0')}/${phase?'large':sub.id}_{code}.geojson`;colors[sub.id]='#123456';methods[sub.id]={source:'Synthetic only',method:'No territorial calculation',formula:'None',legend:[['#123456','Synthetic']]};}
 return `<script>globalThis.__originalExecuted=true;const registry=${JSON.stringify({variables})};const routes=${JSON.stringify(routes)};const methods=${JSON.stringify(methods)};function colorFor(id){const colors=${JSON.stringify(colors)};return colors[id]||'#000000';}function load(id){const c=colorFor(id);map.addLayer({id:'fill',source:'synthetic',type:'fill',paint:{'fill-color':c,'fill-opacity':0.4}});map.addLayer({id:'line',source:'synthetic',type:'line',paint:{'line-color':c,'line-width':1}});map.addLayer({id:'point',source:'synthetic',type:'circle',paint:{'circle-color':c,'circle-radius':5}});}</script>`;
}
let count=0;
for(const plaza of codes)for(const scope of ['evidence','evidence_metro'])for(let v=1;v<=23;v++){
 const tag='V'+String(v).padStart(2,'0');await put(`synthetic/data/${plaza}/${scope}/${tag}/synthetic_${tag.toLowerCase()}_${plaza.toLowerCase()}.geojson`,v>=15&&v<=18?'not JSON':JSON.stringify(collection([feature('synthetic-'+plaza)])));count++;
}
await put('synthetic/data/index_v15.html',reference());count++;
while(count<1255){await put(`synthetic/data/aux_${count}.json`,count===829?'{bad':JSON.stringify({synthetic:true}));count++;}
for(const plaza of codes)for(const dir of ['base','base_metro'])await put(`phase/data/${plaza}/evidence/${dir}/grid_synthetic.geojson`,JSON.stringify(collection([feature('base-'+plaza)])));
await put('phase/data/index_v15.html',reference(true));
await put('phase/data/JRZ/evidence_metro/V22/source_sniiv_jrz.geojson',JSON.stringify(collection([feature('aux-housing')])));
await put('phase/data/JRZ/evidence_metro/V07/source_rnc_jrz.geojson',JSON.stringify(collection([feature('aux-road',{type:'LineString',coordinates:[[-106.42,31.69],[-106.43,31.7]]})])));
const water=JSON.stringify(collection([feature('unresolved-null-water')]));
await put('phase/data/JRZ/evidence_metro/V14/unresolved_water_a.geojson',water);await put('phase/data/JRZ/evidence_metro/V14/unresolved_water_b.geojson',water);
const largePath=resolve(root,'phase/data/JRZ/evidence_metro/V09/large_jrz.geojson');await mkdir(resolve(largePath,'..'),{recursive:true});
const handle=await open(largePath,'wx',0o600);await handle.write('{"type":"FeatureCollection","features":[');
for(let i=0;i<7400;i++){
 const f={type:'Feature',properties:{synthetic_point_id:i,nullable:null,zero:0,note:'S'.repeat(16400)},geometry:{type:'Point',coordinates:[-106.4245+(i%100)*0.0002,31.6904+Math.floor(i/100)*0.0002]}};
 await handle.write((i?',':'')+JSON.stringify(f));
}
await handle.write(']}');await handle.close();
console.log('Created 1255 synthetic inventory files and a separate BASE/117 MiB point/auxiliary fixture. No corporate inputs.');
