import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
const limits: Record<string,[number,number]>={pm25:[0,2000],pm10:[0,3000],temperature:[-50,70],humidity:[0,100],pressure:[300,1100],uv:[0,30]};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 const deviceId=req.headers.get('x-device-id')||'';
 if(!/^[a-f0-9]{64}$/.test(token)||!/^[a-f0-9-]{36}$/.test(deviceId))return reply(401,{error:'Invalid device credentials'});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const auth=await db.rpc('authenticate_device',{target_device:deviceId,credential_hash:hash});
 if(auth.error)return reply(503,{error:'Authentication service unavailable'});
 if(auth.data?.rateLimited)return reply(429,{error:'Upload rate exceeded. Retry next minute with unchanged message IDs.'});
 if(!auth.data)return reply(401,{error:'Device credential invalid, revoked, or device suspended'});
 if(!req.headers.get('content-type')?.includes('application/json'))return reply(415,{error:'JSON required'});
 const reader=req.body?.getReader();if(!reader)return reply(400,{error:'Empty body'});
 let bytes=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>65536){await reader.cancel();return reply(413,{error:'Batch exceeds 64 KiB'});}chunks.push(value);}
 let body;try{const all=new Uint8Array(bytes);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}body=JSON.parse(new TextDecoder().decode(all));}catch{return reply(400,{error:'Invalid JSON'});}
 if(!Array.isArray(body.observations)||!body.observations.length||body.observations.length>100)return reply(400,{error:'Send between 1 and 100 observations'});
 const accepted:string[]=[],duplicates:string[]=[],rejected:{id:string;reason:string}[]=[];
 const now=Date.now();
 for(const row of body.observations){
  const id=typeof row?.id==='string'?row.id:'';
  let reason='';
  if(!id||id.length>120)reason='Invalid message ID';
  else if(typeof row.measuredAt!=='string'||!Number.isFinite(Date.parse(row.measuredAt))||!/(Z|[+-]\d{2}:\d{2})$/.test(row.measuredAt)||Date.parse(row.measuredAt)>now||Date.parse(row.measuredAt)<now-31*86400000)reason='Measurement time must include a timezone, not be in the future, and be within 31 days';
  else if(!Number.isInteger(row.averagingSeconds)||row.averagingSeconds<1||row.averagingSeconds>86400)reason='Unsupported averaging interval';
  else if(!row.raw||typeof row.raw!=='object'||Object.keys(limits).some(k=>!(k in row.raw))||!Object.values(row.raw).some(v=>typeof v==='number'))reason='All six metric keys are required; use null for missing measurements';
  else if(!['valid','suspect'].includes(row.quality)||!Array.isArray(row.flags)||row.flags.length>20||row.flags.some((v:unknown)=>typeof v!=='string'||v.length>100)||(row.quality==='valid'&&row.flags.length)||(row.quality==='suspect'&&!row.flags.length))reason='Quality and flags are inconsistent';
  else if(row.calibrationVersion!==auth.data.calibration_version)reason='Calibration version does not match device registration';
  else if(Object.entries(limits).some(([k,[min,max]])=>row.raw[k]!==null&&(typeof row.raw[k]!=='number'||!Number.isFinite(row.raw[k])||row.raw[k]<min||row.raw[k]>max)))reason='Measurement outside supported engineering range';
  else if(row.corrected!=null)reason='Device uploads must contain raw values only; corrections are controlled separately';
  else if(auth.data.deployment!=='fixed'&&(!Number.isFinite(row.lat)||!Number.isFinite(row.lng)||Math.abs(row.lat)>90||Math.abs(row.lng)>180))reason='Mobile observations require valid coordinates';
  if(reason){rejected.push({id,reason});continue;}
  const raw=Object.fromEntries(Object.keys(limits).map(k=>[k,row.raw[k]]));
  const result=await db.from('device_readings').insert({device_id:deviceId,message_id:id,measured_at:row.measuredAt,averaging_seconds:row.averagingSeconds,raw,corrected:null,quality:row.quality,flags:row.flags,calibration_version:row.calibrationVersion,latitude:auth.data.deployment==='fixed'?auth.data.latitude:row.lat,longitude:auth.data.deployment==='fixed'?auth.data.longitude:row.lng});
  if(result.error?.code==='23505')duplicates.push(id);else if(result.error)return reply(503,{error:'Storage unavailable. Retry the batch with unchanged message IDs.',accepted,duplicates,rejected});else accepted.push(id);
 }
 if(rejected.length){const saved=await db.from('quality_issues').upsert(rejected.map(r=>({device_id:deviceId,message_id:r.id.slice(0,120),reason:r.reason})),{onConflict:'device_id,message_id,reason',ignoreDuplicates:true});if(saved.error)return reply(503,{error:'Issue recording failed. Retry with the same message IDs.',accepted,duplicates,rejected});}
 if(accepted.length||duplicates.length){const r=await db.from('devices').update({last_contact:new Date().toISOString(),state:'active'}).eq('id',deviceId).not('state','in','(maintenance,retired)');if(r.error)return reply(503,{error:'Device status unavailable; retry using the same IDs.',accepted,duplicates,rejected});}
 return reply(200,{accepted,duplicates,rejected});
});
