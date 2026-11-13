// Software Hub Feed backend (Google Apps Script). Same file for every Gmail account.
// Features: public feed (anyone can read) · register/login (email + password) · profile (name + photo) · posts & comments only for logged-in users.
// 1) Run setup() once and Allow.  2) Deploy > New deployment > Web app (Execute as: Me, Access: Anyone).
const KEY='PASTE_YOUR_ADMIN_KEY_HERE';
const MIN_FREE=100*1048576,MAX_WORDS=200,MAX_IMG=5,MAX_IMG_BYTES=3*1048576,PER_HOUR=8,MAX_AV_BYTES=400*1024;
const MAX_CWORDS=80,MAX_CMT=300,PER_HOUR_C=15,REG_PER_HOUR=40;
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
const cleanEm_=v=>{v=String(v||'').trim().toLowerCase();return/^[^\s@|]+@[^\s@|]+\.[^\s@|]{2,}$/.test(v)?v:''};
const sign_=s=>Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s,'tok:'+KEY));
const token_=id=>{const pl=id+'|'+(Date.now()+30*864e5);return Utilities.base64EncodeWebSafe(pl)+'.'+sign_(pl)};
function tokId_(t){try{const a=String(t).split('.'),pl=Utilities.newBlob(Utilities.base64DecodeWebSafe(a[0])).getDataAsString();
  if(sign_(pl)!==a[1])return '';const k=pl.lastIndexOf('|');return Date.now()<+pl.slice(k+1)?pl.slice(0,k):''}catch(e){return ''}}
// ===== Users (register / login / profile). Passwords are stored only as salted hashes. =====
function uload_(){try{const d=JSON.parse(DriveApp.getFileById(P_().getProperty('users')).getBlob().getDataAsString());d.u=d.u||{};d.e=d.e||{};return d}catch(e){return{u:{},e:{}}}}
function usave_(d){const s=JSON.stringify(d),p=P_();
  try{DriveApp.getFileById(p.getProperty('users')).setContent(s);return}catch(e){}
  p.setProperty('users',folders_().root.createFile('users.json',s,'application/json').getId())}
function hash_(pw,salt){const k=Utilities.newBlob(String(salt)).getBytes();let h=Utilities.computeHmacSha256Signature(Utilities.newBlob(String(pw)).getBytes(),k);for(let i=0;i<100;i++)h=Utilities.computeHmacSha256Signature(h,k);return Utilities.base64EncodeWebSafe(h)}
const upub_=u=>({id:u.id,name:u.name,email:u.email,av:u.av||''});
function auth_(d){const id=tokId_(d.token);if(!id)return null;const u=uload_().u[id];if(!u||load_().banned.indexOf(u.email)>=0)return null;return u}
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
const cpub_=c=>({id:c.id,ts:c.ts,uid:c.uid||'',name:c.name,av:c.av||'',text:c.text});
const pub_=p=>({id:p.id,ts:p.ts,uid:p.uid||'',name:p.name,av:p.av||'',type:p.type,app:p.app,text:p.text,imgs:p.imgs,cm:(p.cm||[]).map(cpub_)});
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
  if((e.parameter.action||'list')==='status')return J_(Object.assign({ok:true},space_()));
  const c=CacheService.getScriptCache(),hit=c.get('l0');
  if(hit)return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  const s=JSON.stringify(Object.assign({ok:true,posts:load_().posts.slice(0,50).map(pub_)},space_()));
  if(s.length<90000)c.put('l0',s,30);
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON)}
function doPost(e){let d;
  try{d=JSON.parse(e.postData.contents)}catch(x){return J_({ok:false,error:'bad'})}
  if(KEY.indexOf('PASTE')===0)return J_({ok:false,error:'not_configured'});
  const L=LockService.getScriptLock();
  try{if(d.action==='login')return J_(login_(d));
    if(d.action==='me')return J_(me_(d));
    if(d.action==='reset_code')return J_(rcode_(d));
    if(d.action==='hit'){L.waitLock(8000);return J_(hit_(d))}
    L.waitLock(25000);
    if(d.action==='register')return J_(register_(d));
    if(d.action==='profile')return J_(profile_(d));
    if(d.action==='reset')return J_(reset_(d));
    if(d.action==='post')return J_(post_(d));
    if(d.action==='comment')return J_(comment_(d));
    if(String(d.action).indexOf('admin_')===0)return J_(admin_(d));
    return J_({ok:false,error:'bad'})}
  catch(err){return J_({ok:false,error:String(err.message||err)})}
  finally{try{L.releaseLock()}catch(x){}}}
function cleanName_(v){return String(v||'').replace(/\s+/g,' ').trim().slice(0,40)}
function register_(d){
  const em=cleanEm_(d.email),name=cleanName_(d.name),pw=String(d.password||'');
  if(!em)return{ok:false,error:'bad_email'};
  if(name.length<2)return{ok:false,error:'name'};
  if(hasLink_(name))return{ok:false,error:'no_links'};
  if(pw.length<6||pw.length>64)return{ok:false,error:'weak'};
  if(load_().banned.indexOf(em)>=0)return{ok:false,error:'banned'};
  const c=CacheService.getScriptCache(),rk='g:'+Math.floor(Date.now()/36e5),n=+(c.get(rk)||0);
  if(n>=REG_PER_HOUR)return{ok:false,error:'too_many'};c.put(rk,String(n+1),3600);
  const db=uload_();if(db.e[em])return{ok:false,error:'exists'};
  const id=Utilities.getUuid().replace(/-/g,'').slice(0,12),salt=Utilities.getUuid();
  const u={id:id,name:name,email:em,salt:salt,hash:hash_(pw,salt),av:'',ts:Date.now()};
  db.u[id]=u;db.e[em]=id;usave_(db);return{ok:true,token:token_(id),user:upub_(u)}}
function login_(d){
  const em=cleanEm_(d.email);if(!em)return{ok:false,error:'bad_email'};
  const c=CacheService.getScriptCache(),k='l:'+em,n=+(c.get(k)||0);if(n>=10)return{ok:false,error:'too_many'};c.put(k,String(n+1),600);
  const db=uload_(),id=db.e[em];if(!id)return{ok:false,error:'no_user'};
  const u=db.u[id];if(hash_(d.password||'',u.salt)!==u.hash)return{ok:false,error:'bad_login'};
  if(load_().banned.indexOf(em)>=0)return{ok:false,error:'banned'};
  c.remove(k);return{ok:true,token:token_(id),user:upub_(u)}}
function me_(d){const u=auth_(d);return u?{ok:true,user:upub_(u)}:{ok:false,error:'auth_user'}}
function profile_(d){
  const u0=auth_(d);if(!u0)return{ok:false,error:'auth_user'};
  const db=uload_(),u=db.u[u0.id];
  if(d.name!==undefined){const name=cleanName_(d.name);if(name.length<2)return{ok:false,error:'name'};if(hasLink_(name))return{ok:false,error:'no_links'};u.name=name}
  if(d.remove_av){if(u.av)trash_([u.av]);u.av=''}
  else if(d.avatar){const m=/^data:image\/(jpeg|png|webp);base64,/.exec(String(d.avatar));if(!m)return{ok:false,error:'bad_image'};
    const b=Utilities.base64Decode(String(d.avatar).slice(m[0].length));if(b.length>MAX_AV_BYTES)return{ok:false,error:'img_big'};
    if(space_().full)return{ok:false,error:'full'};
    const f=folders_().im.createFile(Utilities.newBlob(b,'image/'+m[1],'av_'+u.id+'_'+Date.now()+'.'+m[1]));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);if(u.av)trash_([u.av]);u.av=f.getId()}
  usave_(db);
  const idx=load_();idx.posts.forEach(p=>{if(p.uid===u.id){p.name=u.name;p.av=u.av}(p.cm||[]).forEach(c=>{if(c.uid===u.id){c.name=u.name;c.av=u.av}})});
  save_(idx);clear_();return{ok:true,user:upub_(u)}}
// Forgot password: a 6-digit code is emailed, then the new password is set.
function rcode_(d){const em=cleanEm_(d.email);if(!em)return{ok:false,error:'bad_email'};
  if(!uload_().e[em])return{ok:false,error:'no_user'};
  const c=CacheService.getScriptCache(),n=+(c.get('s:'+em)||0);if(n>=4)return{ok:false,error:'too_many'};c.put('s:'+em,String(n+1),3600);
  if(MailApp.getRemainingDailyQuota()<1)return{ok:false,error:'mail_failed'};
  const code=String(100000+parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,7),16)%900000);c.put('c:'+em,code,600);
  try{MailApp.sendEmail(em,'Your password reset code: '+code,'Your code is '+code+' (valid for 10 minutes).\nIf you did not request it, just ignore this email.')}catch(x){return{ok:false,error:'mail_failed'}}
  return{ok:true}}
function reset_(d){const em=cleanEm_(d.email),c=CacheService.getScriptCache(),a=+(c.get('a:'+em)||0),pw=String(d.password||'');
  if(!em||a>=6)return{ok:false,error:'too_many'};c.put('a:'+em,String(a+1),600);
  if(pw.length<6||pw.length>64)return{ok:false,error:'weak'};
  const code=c.get('c:'+em);if(!code)return{ok:false,error:'expired'};
  if(code!==String(d.code||'').trim())return{ok:false,error:'wrong_code'};
  const db=uload_(),id=db.e[em];if(!id)return{ok:false,error:'no_user'};
  const u=db.u[id];u.salt=Utilities.getUuid();u.hash=hash_(pw,u.salt);usave_(db);c.remove('c:'+em);c.remove('l:'+em);
  return{ok:true,token:token_(id),user:upub_(u)}}
function post_(d){
  const u=auth_(d);if(!u)return{ok:false,error:'auth_user'};
  const db=load_();if(space_().full)return{ok:false,error:'full'};
  const text=String(d.text||'').trim(),n=text.split(/\s+/).filter(Boolean).length;
  if(!n)return{ok:false,error:'empty'};
  if(hasLink_(text)||hasLink_(d.app))return{ok:false,error:'no_links'};
  if(n>MAX_WORDS||text.length>3000)return{ok:false,error:'too_long'};
  const im=Array.isArray(d.images)?d.images:[];if(im.length>MAX_IMG)return{ok:false,error:'bad_image'};
  const c=CacheService.getScriptCache(),rk='r:'+u.id,r=+(c.get(rk)||0);
  if(r>=PER_HOUR)return{ok:false,error:'too_many'};c.put(rk,String(r+1),3600);
  const id=Utilities.getUuid().replace(/-/g,'').slice(0,12),ids=[],dir=folders_().im;
  try{im.forEach((s,i)=>{const m=/^data:image\/(jpeg|png|webp);base64,/.exec(s);if(!m)throw new Error('bad_image');
    const b=Utilities.base64Decode(s.slice(m[0].length));if(b.length>MAX_IMG_BYTES)throw new Error('img_big');
    const f=dir.createFile(Utilities.newBlob(b,'image/'+m[1],id+'_'+i+'.'+m[1]));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);ids.push(f.getId())})}
  catch(x){trash_(ids);return{ok:false,error:String(x.message)}}
  const p={id:id,ts:Date.now(),uid:u.id,name:u.name,av:u.av||'',email:u.email,type:['request','bug','idea'].indexOf(d.type)>=0?d.type:'other',app:String(d.app||'').slice(0,60),text:text,imgs:ids};
  db.posts.unshift(p);save_(db);clear_();return{ok:true,post:pub_(p)}}
function comment_(d){
  const u=auth_(d);if(!u)return{ok:false,error:'auth_user'};
  const db=load_();
  const p=db.posts.find(x=>x.id===String(d.pid||''));if(!p)return{ok:false,error:'gone'};
  const text=String(d.text||'').trim(),n=text.split(/\s+/).filter(Boolean).length;
  if(!n)return{ok:false,error:'empty'};
  if(hasLink_(text))return{ok:false,error:'no_links'};
  if(n>MAX_CWORDS||text.length>800)return{ok:false,error:'too_long_c'};
  p.cm=p.cm||[];if(p.cm.length>=MAX_CMT)return{ok:false,error:'cfull'};
  if(space_().full)return{ok:false,error:'full'};
  const c=CacheService.getScriptCache(),rk='k:'+u.id,r=+(c.get(rk)||0);
  if(r>=PER_HOUR_C)return{ok:false,error:'too_many'};c.put(rk,String(r+1),3600);
  const cm={id:Utilities.getUuid().replace(/-/g,'').slice(0,10),ts:Date.now(),uid:u.id,name:u.name,av:u.av||'',email:u.email,text:text};
  p.cm.push(cm);save_(db);clear_();return{ok:true,comment:cpub_(cm)}}
function admin_(d){
  if(d.key!==KEY)return{ok:false,error:'auth'};
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
  if(d.action==='admin_list')return Object.assign({ok:true,posts:db.posts.slice(0,100),banned:db.banned,users:Object.keys(uload_().u).length},space_());
  if(d.action==='admin_delete'){const p=db.posts.find(x=>x.id===d.id);if(p){trash_(p.imgs);db.posts=db.posts.filter(x=>x!==p)}}
  else if(d.action==='admin_delcomment'){const p=db.posts.find(x=>x.id===d.pid);if(p&&p.cm)p.cm=p.cm.filter(c=>c.id!==d.cid)}
  else if(d.action==='admin_ban'){if(db.banned.indexOf(em)<0)db.banned.push(em);
    if(d.purge){db.posts=db.posts.filter(x=>{if(x.email!==em)return true;trash_(x.imgs);return false});db.posts.forEach(x=>{if(x.cm)x.cm=x.cm.filter(c=>c.email!==em)})}}
  else if(d.action==='admin_unban')db.banned=db.banned.filter(x=>x!==em);
  else return{ok:false,error:'bad'};
  save_(db);clear_();return{ok:true}}
