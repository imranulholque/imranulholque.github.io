// Software Hub Feed backend (Google Apps Script). Same file for every Gmail account.
// 1) Run setup() once and Allow.  2) Deploy > New deployment > Web app (Execute as: Me, Access: Anyone).
const KEY='PASTE_YOUR_ADMIN_KEY_HERE';
const MIN_FREE=100*1048576,MAX_WORDS=200,MAX_IMG=5,MAX_IMG_BYTES=3*1048576,PER_HOUR=5,PER_HOUR_UNV=2;
const MAX_CWORDS=80,MAX_CMT=300,PER_HOUR_C=12,PER_HOUR_C_UNV=5;
// Link blocker: posts and comments can never contain links (checked here on the server, so it cannot be bypassed from the browser).
const TLD_='com|net|org|io|me|co|app|dev|xyz|info|biz|link|ly|gl|be|tv|bd|in|us|uk|site|online|store|tech|ai|gg|cc|ws|to|fm|page|live|shop|top|click|cloud|pro|club|vip|fun|icu|one|bio|ink|wiki|edu|gov|mil|int|asia|news|blog|world|space|website|download|zip|mov|so|sh|im|ru|cn|de|fr|jp|kr|pk|np|lk|ae|sa|ca|au|nz|za|ng|ke|br|mx|ar|es|it|nl|se|no|fi|pl|ua|tr|ir|id|my|sg|ph|vn|th|tw|hk';
function hasLink_(t){
  let s=String(t||'');try{s=s.normalize('NFKC')}catch(e){}
  s=s.replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g,'').toLowerCase();
  s=s.replace(/\s*[\[\(\{]\s*(?:dot|\.)\s*[\]\)\}]\s*/g,'.')
     .replace(new RegExp('\\s+(?:dot|\u09a1\u099f)\\s+(?=(?:'+TLD_+')\\b)','g'),'.')
     .replace(new RegExp('([a-z0-9])\\s+\\.\\s*(?=(?:'+TLD_+')\\b)','g'),'$1.')
     .replace(/\bh\s*t\s*t\s*p\s*s?\s*:\s*\/\s*\//g,'http://');
  if(/(?:https?|ftp|ftps|file):\/\/|\/\/[a-z0-9-]+\.|\bwww\s*\.|\bmailto:|\b(?:t\.me|wa\.me|bit\.ly|tinyurl|youtu\.be|goo\.gl|fb\.me|m\.me|discord\.gg|linktr\.ee)\b/.test(s))return true;
  return new RegExp('[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:'+TLD_+')(?![a-z0-9-])(?:[\\/:?#]|\\b)').test(s)}
function setup(){folders_();Logger.log('OK, used '+DriveApp.getStorageUsed())}
const mode_=()=>P_().getProperty('mode')||'optional';
const cleanEm_=v=>{v=String(v||'').trim().toLowerCase();return/^[^\s@|]+@[^\s@|]+\.[^\s@|]{2,}$/.test(v)?v:''};
const sign_=s=>Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s,'tok:'+KEY));
const token_=em=>{const pl=em+'|'+(Date.now()+30*864e5);return Utilities.base64EncodeWebSafe(pl)+'.'+sign_(pl)};
function tokOk_(t,em){try{const a=String(t).split('.'),pl=Utilities.newBlob(Utilities.base64DecodeWebSafe(a[0])).getDataAsString();
  if(sign_(pl)!==a[1])return false;const k=pl.lastIndexOf('|');return pl.slice(0,k)===em&&Date.now()<+pl.slice(k+1)}catch(e){return false}}
function dl_(){const p=P_();try{return DriveApp.getFolderById(p.getProperty('dl'))}catch(e){const f=folders_().root.createFolder('downloads');p.setProperty('dl',f.getId());return f}}
const J_=o=>ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const P_=()=>PropertiesService.getScriptProperties();
function folders_(){const p=P_();let r=null,im=null;
  try{r=DriveApp.getFolderById(p.getProperty('root'))}catch(e){}
  if(!r||r.isTrashed()){r=DriveApp.createFolder('SoftwareHub Feed');p.setProperty('root',r.getId());p.deleteProperty('imgs');p.deleteProperty('index')}
  try{im=DriveApp.getFolderById(p.getProperty('imgs'))}catch(e){}
  if(!im){im=r.createFolder('images');p.setProperty('imgs',im.getId())}
  return{root:r,im:im}}
function load_(){try{const d=JSON.parse(DriveApp.getFileById(P_().getProperty('index')).getBlob().getDataAsString());d.banned=d.banned||[];return d}catch(e){return{posts:[],banned:[]}}}
function save_(d){const s=JSON.stringify(d),p=P_();
  try{DriveApp.getFileById(p.getProperty('index')).setContent(s);return}catch(e){}
  p.setProperty('index',folders_().root.createFile('index.json',s,'application/json').getId())}
function space_(){let u=0,l=0;try{u=DriveApp.getStorageUsed();l=DriveApp.getStorageLimit()}catch(e){}
  return{used:u,limit:l,free:l?l-u:null,full:!!l&&l-u<MIN_FREE}}
const cpub_=c=>({id:c.id,ts:c.ts,name:c.name,v:!!c.v,text:c.text});
const pub_=p=>({v:!!p.v,id:p.id,ts:p.ts,name:p.name,type:p.type,app:p.app,text:p.text,imgs:p.imgs,cm:(p.cm||[]).map(cpub_)});
function trash_(ids){(ids||[]).forEach(i=>{try{DriveApp.getFileById(i).setTrashed(true)}catch(e){}})}
const clear_=()=>CacheService.getScriptCache().remove('l0');
// ===== Visitor stats (anonymous: random browser id, country code, device/browser/OS, referrer host, page). No IP is stored. =====
const TZ_='Asia/Dhaka',KEEP_DAYS=120,MAX_UIDS=4000;
function sload_(){try{const d=JSON.parse(DriveApp.getFileById(P_().getProperty('stats')).getBlob().getDataAsString());d.days=d.days||{};return d}catch(e){return{days:{}}}}
function ssave_(d){const s=JSON.stringify(d),p=P_();
  try{DriveApp.getFileById(p.getProperty('stats')).setContent(s);return}catch(e){}
  p.setProperty('stats',folders_().root.createFile('stats.json',s,'application/json').getId())}
const inc_=(o,k)=>{k=String(k||'').replace(/[^\w .\-\/]/g,'').slice(0,40)||'other';o[k]=(o[k]||0)+1};
function hit_(d){
  const vid=String(d.vid||'');if(!/^[a-z0-9]{8,24}$/.test(vid))return{ok:false,error:'bad'};
  const c=CacheService.getScriptCache(),rk='h:'+vid,n=+(c.get(rk)||0);if(n>=40)return{ok:false,error:'too_many'};c.put(rk,String(n+1),3600);
  const st=sload_(),day=Utilities.formatDate(new Date(),TZ_,'yyyy-MM-dd');
  const D=st.days[day]=st.days[day]||{v:0,u:[],c:{},d:{},b:{},o:{},r:{},p:{}};
  D.v++;inc_(D.p,d.page||'home');
  if(D.u.indexOf(vid)<0&&D.u.length<MAX_UIDS){
    D.u.push(vid);
    inc_(D.c,/^[A-Z]{2}$/.test(d.cc)?d.cc:'XX');
    inc_(D.d,['mobile','tablet','desktop'].indexOf(d.dev)>=0?d.dev:'desktop');
    inc_(D.b,d.br);inc_(D.o,d.os);inc_(D.r,d.ref||'direct');
  }
  const keys=Object.keys(st.days).sort();while(keys.length>KEEP_DAYS)delete st.days[keys.shift()];
  ssave_(st);return{ok:true}}
function stats_(){const st=sload_(),out={};
  Object.keys(st.days).forEach(k=>{const D=st.days[k];out[k]={v:D.v,u:D.u.length,c:D.c,d:D.d,b:D.b,o:D.o,r:D.r,p:D.p}});return{ok:true,days:out,today:Utilities.formatDate(new Date(),TZ_,'yyyy-MM-dd')}}
function doGet(e){
  if((e.parameter.action||'list')==='status')return J_(Object.assign({ok:true,mode:mode_()},space_()));
  const c=CacheService.getScriptCache(),hit=c.get('l0');
  if(hit)return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  const s=JSON.stringify(Object.assign({ok:true,mode:mode_(),posts:load_().posts.slice(0,50).map(pub_)},space_()));
  if(s.length<90000)c.put('l0',s,30);
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON)}
function doPost(e){let d;
  try{d=JSON.parse(e.postData.contents)}catch(x){return J_({ok:false,error:'bad'})}
  if(KEY.indexOf('PASTE')===0)return J_({ok:false,error:'not_configured'});
  const L=LockService.getScriptLock();
  try{if(d.action==='send_code'||d.action==='verify')return J_(d.action==='verify'?verify_(d):code_(d));
    if(d.action==='hit'){L.waitLock(8000);return J_(hit_(d))}
    L.waitLock(25000);
    if(d.action==='post')return J_(post_(d));
    if(d.action==='comment')return J_(comment_(d));
    if(String(d.action).indexOf('admin_')===0)return J_(admin_(d));
    return J_({ok:false,error:'bad'})}
  catch(err){return J_({ok:false,error:String(err.message||err)})}
  finally{try{L.releaseLock()}catch(x){}}}
function code_(d){const em=cleanEm_(d.email);if(!em)return{ok:false,error:'bad_email'};
  if(load_().banned.indexOf(em)>=0)return{ok:false,error:'banned'};
  const c=CacheService.getScriptCache(),n=+(c.get('s:'+em)||0);if(n>=5)return{ok:false,error:'too_many'};c.put('s:'+em,String(n+1),3600);
  if(MailApp.getRemainingDailyQuota()<1)return{ok:false,error:'mail_failed'};
  const code=String(100000+parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,7),16)%900000);c.put('c:'+em,code,600);
  try{MailApp.sendEmail(em,'Your verification code: '+code,'Your code is '+code+' (valid for 10 minutes).\nIf you did not request it, just ignore this email.')}catch(x){return{ok:false,error:'mail_failed'}}
  return{ok:true}}
function verify_(d){const em=cleanEm_(d.email),c=CacheService.getScriptCache(),a=+(c.get('a:'+em)||0);
  if(!em||a>=6)return{ok:false,error:'too_many'};c.put('a:'+em,String(a+1),600);
  const code=c.get('c:'+em);if(!code)return{ok:false,error:'expired'};
  if(code!==String(d.code||'').trim())return{ok:false,error:'wrong_code'};
  c.remove('c:'+em);return{ok:true,token:token_(em)}}
function post_(d){
  const em=cleanEm_(d.email);
  if(!em)return{ok:false,error:'bad_email'};
  const ver=tokOk_(d.token,em);if(!ver&&mode_()==='required')return{ok:false,error:'verify'};
  const db=load_();if(db.banned.indexOf(em)>=0)return{ok:false,error:'banned'};
  if(space_().full)return{ok:false,error:'full'};
  const name=String(d.name||'').trim().slice(0,40),text=String(d.text||'').trim(),n=text.split(/\s+/).filter(Boolean).length;
  if(name.length<2)return{ok:false,error:'name'};
  if(!n)return{ok:false,error:'empty'};
  if(hasLink_(name)||hasLink_(text)||hasLink_(d.app))return{ok:false,error:'no_links'};
  if(n>MAX_WORDS||text.length>3000)return{ok:false,error:'too_long'};
  const im=Array.isArray(d.images)?d.images:[];if(im.length>MAX_IMG)return{ok:false,error:'bad_image'};
  const c=CacheService.getScriptCache(),rk='r:'+em,r=+(c.get(rk)||0);
  if(r>=(ver?PER_HOUR:PER_HOUR_UNV))return{ok:false,error:'too_many'};c.put(rk,String(r+1),3600);
  const id=Utilities.getUuid().replace(/-/g,'').slice(0,12),ids=[],dir=folders_().im;
  try{im.forEach((s,i)=>{const m=/^data:image\/(jpeg|png|webp);base64,/.exec(s);if(!m)throw new Error('bad_image');
    const b=Utilities.base64Decode(s.slice(m[0].length));if(b.length>MAX_IMG_BYTES)throw new Error('img_big');
    const f=dir.createFile(Utilities.newBlob(b,'image/'+m[1],id+'_'+i+'.'+m[1]));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);ids.push(f.getId())})}
  catch(x){trash_(ids);return{ok:false,error:String(x.message)}}
  const p={v:ver,id:id,ts:Date.now(),name:name,email:em,type:['request','bug','idea'].indexOf(d.type)>=0?d.type:'other',app:String(d.app||'').slice(0,60),text:text,imgs:ids};
  db.posts.unshift(p);save_(db);clear_();return{ok:true,post:pub_(p)}}
function comment_(d){
  const em=cleanEm_(d.email);if(!em)return{ok:false,error:'bad_email'};
  const ver=tokOk_(d.token,em);if(!ver&&mode_()==='required')return{ok:false,error:'verify'};
  const db=load_();if(db.banned.indexOf(em)>=0)return{ok:false,error:'banned'};
  const p=db.posts.find(x=>x.id===String(d.pid||''));if(!p)return{ok:false,error:'gone'};
  const name=String(d.name||'').trim().slice(0,40),text=String(d.text||'').trim(),n=text.split(/\s+/).filter(Boolean).length;
  if(name.length<2)return{ok:false,error:'name'};
  if(!n)return{ok:false,error:'empty'};
  if(hasLink_(name)||hasLink_(text))return{ok:false,error:'no_links'};
  if(n>MAX_CWORDS||text.length>800)return{ok:false,error:'too_long_c'};
  p.cm=p.cm||[];if(p.cm.length>=MAX_CMT)return{ok:false,error:'cfull'};
  if(space_().full)return{ok:false,error:'full'};
  const c=CacheService.getScriptCache(),rk='k:'+em,r=+(c.get(rk)||0);
  if(r>=(ver?PER_HOUR_C:PER_HOUR_C_UNV))return{ok:false,error:'too_many'};c.put(rk,String(r+1),3600);
  const cm={id:Utilities.getUuid().replace(/-/g,'').slice(0,10),ts:Date.now(),name:name,email:em,v:ver,text:text};
  p.cm.push(cm);save_(db);clear_();return{ok:true,comment:cpub_(cm)}}
function admin_(d){
  if(d.key!==KEY)return{ok:false,error:'auth'};
  if(d.action==='admin_setmode'){P_().setProperty('mode',['off','optional','required'].indexOf(d.mode)>=0?d.mode:'optional');clear_();return{ok:true}}
  if(d.action==='admin_up_start'){const sp=space_();if(sp.free!==null&&sp.free<d.size+MIN_FREE)return{ok:false,error:'full'};
    const r=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',{method:'post',contentType:'application/json',
      headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken(),'X-Upload-Content-Type':d.mime||'application/octet-stream','X-Upload-Content-Length':String(d.size)},
      payload:JSON.stringify({name:String(d.name).slice(0,120),parents:[dl_().getId()]}),muteHttpExceptions:true});
    const h=r.getHeaders(),loc=h['Location']||h['location'];if(r.getResponseCode()!==200||!loc)return{ok:false,error:'start_failed'};
    CacheService.getScriptCache().put('u:'+d.uid,loc,21000);return{ok:true}}
  if(d.action==='admin_up_chunk'){const loc=CacheService.getScriptCache().get('u:'+d.uid);if(!loc)return{ok:false,error:'no_session'};
    const b=Utilities.base64Decode(d.data),r=UrlFetchApp.fetch(loc,{method:'put',contentType:d.mime||'application/octet-stream',
      headers:{'Content-Range':'bytes '+d.start+'-'+(d.start+b.length-1)+'/'+d.size},payload:b,muteHttpExceptions:true}),c=r.getResponseCode();
    if(c===308)return{ok:true,done:false};
    if(c===200||c===201){const id=JSON.parse(r.getContentText()).id;DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);return{ok:true,done:true,id:id}}
    return{ok:false,error:'chunk_failed_'+c}}
  if(d.action==='admin_stats')return stats_();
  const db=load_(),em=String(d.email||'').toLowerCase();
  if(d.action==='admin_list')return Object.assign({ok:true,posts:db.posts.slice(0,100),banned:db.banned},space_());
  if(d.action==='admin_delete'){const p=db.posts.find(x=>x.id===d.id);if(p){trash_(p.imgs);db.posts=db.posts.filter(x=>x!==p)}}
  else if(d.action==='admin_delcomment'){const p=db.posts.find(x=>x.id===d.pid);if(p&&p.cm)p.cm=p.cm.filter(c=>c.id!==d.cid)}
  else if(d.action==='admin_ban'){if(db.banned.indexOf(em)<0)db.banned.push(em);
    if(d.purge){db.posts=db.posts.filter(x=>{if(x.email!==em)return true;trash_(x.imgs);return false});db.posts.forEach(x=>{if(x.cm)x.cm=x.cm.filter(c=>c.email!==em)})}}
  else if(d.action==='admin_unban')db.banned=db.banned.filter(x=>x!==em);
  else return{ok:false,error:'bad'};
  save_(db);clear_();return{ok:true}}
