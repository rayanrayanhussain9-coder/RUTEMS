import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
const allowedOrigin=Deno.env.get('APP_ORIGIN')||'http://localhost:3000';
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&origin!==allowedOrigin)return reply(403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 const jwt=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!jwt)return reply(401,{error:'Sign in required'});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const verified=await db.auth.getClaims(jwt);if(verified.error||!verified.data?.claims.sub)return reply(401,{error:'Invalid session'});
 const user=await db.auth.getUser(jwt);if(user.error||!user.data.user)return reply(401,{error:'Session unavailable'});
 if(verified.data.claims.aal!=='aal2')return reply(403,{error:'Authenticator verification required'});
 const staff=await db.from('staff_members').select('role,active').eq('user_id',user.data.user.id).maybeSingle();
 if(staff.error||staff.data?.role!=='admin'||!staff.data.active)return reply(403,{error:'Active administrator required'});
 const content=await req.text();if(new TextEncoder().encode(content).length>2048)return reply(413,{error:'Request too large'});
 let body;try{body=JSON.parse(content);}catch{return reply(400,{error:'Invalid JSON'});}
 if(typeof body.email!=='string'||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email)||!['admin','operator'].includes(body.role))return reply(400,{error:'Enter an email and staff role'});
 const invite=await db.auth.admin.inviteUserByEmail(body.email.trim(),{redirectTo:allowedOrigin+'/login'});
 if(invite.error)return reply(400,{error:invite.error.message});
 const assignment=await db.from('staff_members').insert({user_id:invite.data.user.id,role:body.role});
 if(assignment.error)return reply(503,{error:'Account invitation requested, but staff access was not assigned. Use Staff access after confirmation.'});
 return reply(200,{message:'Invitation requested and staff role assigned. The recipient must accept the email invitation and set a password.'});
});
