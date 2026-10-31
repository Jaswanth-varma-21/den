
// Brand data: only widely documented facts; ABV given for the named flagship product only.
const D=window.D;
const cat=[...new Set(D.map(d=>d[2])),'Favorites'];
let TK=sessionStorage.getItem('tk')||'',FV=[],RC=[];
const sid=(()=>{let s=sessionStorage.getItem('sid');if(!s){s=crypto.randomUUID();sessionStorage.setItem('sid',s)}return s})();
async function api(p,o={}){const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',...(TK?{Authorization:'Bearer '+TK}:{}),...(o.headers||{})}});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||r.status);return r.status==204?null:r.json()}
const idx=pid=>D.findIndex(d=>d[7]==pid);
async function sync(){if(!TK)return;try{FV=(await api('/me/favorites')).products.map(p=>idx(p.id));RC=(await api('/me/recent')).items.map(p=>idx(p.id));apply();if(window.Shop)Shop.refresh()}catch(e){TK='';sessionStorage.removeItem('tk')}}
window.fav=async i=>{if(!TK){alert('Log in to save favorites (Login button at the top).');return}try{await api('/me/favorites/products/'+D[i][7],{method:FV.includes(i)?'DELETE':'PUT'});await sync();choose(B[i])}catch(e){alert(e.message)}};
window.login=async()=>{const email=prompt('Email'),password=email&&prompt('Password (min 8 chars, letters and a digit)');if(!password)return;try{let r;try{r=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})})}catch(e){if(!confirm('Login failed. Create a new account with these details?'))return;r=await api('/auth/register',{method:'POST',body:JSON.stringify({email,password,username:email.split('@')[0]})})}TK=r.token;sessionStorage.setItem('tk',TK);await sync()}catch(e){alert(e.message)}};
const track=(type,entityType,entityId)=>api('/track',{method:'POST',body:JSON.stringify({type,entityType,entityId,sessionId:sid})}).catch(()=>{});
track('visit');setTimeout(sync,0);
const bar=document.getElementById('bar');
cat.unshift('All');
cat.forEach(c=>{const b=document.createElement('button');b.textContent=c;b.onclick=()=>{filt=c;[...bar.querySelectorAll('button')].forEach(x=>x.classList.toggle('on',x===b));apply()};if(c=='All')b.className='on';bar.appendChild(b)});
const cn=document.createElement('select');['All',...new Set(D.map(d=>d[3]))].forEach(c=>cn.add(new Option(c==='All'?'All countries':c,c)));cn.style.cssText='background:#0008;color:#f0e6d2;border:1px solid #d9a44166;padding:6px';cn.onchange=()=>apply();bar.appendChild(cn);[['Bar',0],['Whisky Library',1],['Login',2]].forEach(([n,r])=>{const b=document.createElement('button');b.textContent=(r==2?'':'→ ')+n;b.onclick=()=>r==2?login():goRoom(r);bar.appendChild(b)});
let filt='All';
const R=new THREE.WebGLRenderer({antialias:true});R.setSize(innerWidth,innerHeight);R.setPixelRatio(Math.min(devicePixelRatio,2));R.shadowMap.enabled=true;R.toneMapping=THREE.ACESFilmicToneMapping;
document.body.prepend(R.domElement);
const S=new THREE.Scene();S.background=new THREE.Color(0x0d0805);S.fog=new THREE.Fog(0x0d0805,10,26);
const C=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,60);C.position.set(0,1.7,16);
const M=(c,r=.6,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const add=(g,m,x,y,z,p=S)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o};
// room
add(new THREE.PlaneGeometry(14,16),M(0x3a2312,.35),0,0,2).rotation.x=-Math.PI/2;
add(new THREE.PlaneGeometry(14,6),M(0x2a1a10,.9),0,3,-3.6);
add(new THREE.PlaneGeometry(16,6),M(0x2a1a10,.9),-7,3,2).rotation.y=Math.PI/2;
add(new THREE.PlaneGeometry(16,6),M(0x2a1a10,.9),7,3,2).rotation.y=-Math.PI/2;
add(new THREE.PlaneGeometry(14,16),M(0x120a05),0,6,2).rotation.x=Math.PI/2;
// shelves
[1.5,2.6].forEach(y=>add(new THREE.BoxGeometry(11,.08,.7),M(0x6b4423,.4),0,y,-3.2));
add(new THREE.BoxGeometry(11,.08,.7),M(0x6b4423,.4),0,.4,-3.2);
// counter
add(new THREE.BoxGeometry(9,1.1,1.1),M(0x4a2c15,.3),0,.55,.6);
add(new THREE.BoxGeometry(9.3,.12,1.4),M(0x1b100a,.15,.2),0,1.14,.6);
// lights
S.add(new THREE.AmbientLight(0xffd9a0,.35));
[-4,0,4].forEach(x=>{const l=new THREE.SpotLight(0xffc477,2.2,14,.6,.6);l.position.set(x,5.2,1);l.target.position.set(x,2,-3.2);l.castShadow=true;l.shadow.mapSize.set(512,512);S.add(l,l.target)});
const pl=new THREE.PointLight(0xffb060,1.2,10);pl.position.set(0,2.5,2);S.add(pl);
// Whisky Library (separate room at x=-24)
const LX=-24;let room=0,ox=0;
{const wd=M(0x2a160a,.6);
 add(new THREE.PlaneGeometry(12,16),M(0x1f1008,.3),LX,0,2).rotation.x=-Math.PI/2;
 add(new THREE.PlaneGeometry(12,6),wd,LX,3,-3.6);
 add(new THREE.PlaneGeometry(12,6),wd,LX,3,12.4).rotation.y=Math.PI;
 add(new THREE.PlaneGeometry(16,6),wd,LX-6,3,2).rotation.y=Math.PI/2;
 add(new THREE.PlaneGeometry(16,6),wd,LX+6,3,2).rotation.y=-Math.PI/2;
 add(new THREE.PlaneGeometry(12,16),M(0x0e0704),LX,6,2).rotation.x=Math.PI/2;
 [.4,1.5,2.6].forEach(y=>add(new THREE.BoxGeometry(7,.08,.7),M(0x4a2a12,.4),LX,y,-3.2));
 add(new THREE.BoxGeometry(2.4,.12,1.4),M(0x1b100a,.2,.2),LX,.9,5);
 [-.9,.9].forEach(x=>add(new THREE.CylinderGeometry(.08,.08,.9,10),M(0x1b100a,.4),LX+x,.45,5));
 [-1,1].forEach(s=>{add(new THREE.BoxGeometry(1,.5,1),M(0x5a1d12,.6),LX+s*2.4,.25,5);add(new THREE.BoxGeometry(.25,.9,1),M(0x5a1d12,.6),LX+s*2.9,.7,5)});
 [-2.5,2.5].forEach(x=>{const l=new THREE.PointLight(0xffa040,1.4,9);l.position.set(LX+x,4,0);S.add(l)})}
function goRoom(r){if(r==room||!started)return;closeP();const f=document.getElementById('fade');f.style.opacity=1;setTimeout(()=>{room=r;ox=r?LX:0;VS.x=ox;P.set(ox,1.7,9);yaw=0;pitch=0;C.position.copy(P);f.style.opacity=0},650)}
// bottles
const prof=[[0,0],[.2,0],[.22,.05],[.22,.6],[.15,.8],[.07,.95],[.07,1.15],[.09,1.18],[.09,1.22],[0,1.22]].map(p=>new THREE.Vector2(...p));
const bg=new THREE.LatheGeometry(prof,28);
const lg=new THREE.LatheGeometry([[0,.05],[.19,.05],[.2,.08],[.2,.6],[.13,.78],[0,.78]].map(p=>new THREE.Vector2(...p)),24),LQ={Whisky:0xb5651d,Vodka:0xdfe8ee,Rum:0xa0642a,Gin:0xdde8e0,Tequila:0xe6dcbc,Wine:0x5a1020,Champagne:0xe3c87a,Beer:0xc8921a,Cognac:0x8a4a14};
function LT(d){const c=document.createElement('canvas');c.width=1024;c.height=128;const x=c.getContext('2d');x.fillStyle='#f0e6d2';x.fillRect(0,0,1024,128);x.fillStyle='#2a170a';x.textAlign='center';x.font='bold 30px Georgia';x.fillText(d[0],256,56);x.font='20px Georgia';x.fillText(d[1],256,92);x.fillText(d[2]+' · '+d[3],768,56);x.fillText('ABV: '+d[5],768,92);return new THREE.CanvasTexture(c)}
const B=[];
D.forEach((d,i)=>{
 const lib=i>=16&&d[2]=='Whisky',k=i<16?-1:D.slice(16,i).filter(e=>(e[2]=='Whisky')==lib).length,row=lib?k>>2:(i<8?0:(k<0?1:2)),col=lib?k%4:(k<0?i%8:k%8),x=lib?LX-2.1+col*1.4:-4.2+col*1.2,y=[1.5,2.6,1.2][row],zz=!lib&&row==2?.8:-3.2;
 const g=new THREE.Group();g.position.set(x,y+.04,zz);S.add(g);
 const glass=new THREE.MeshPhysicalMaterial({color:d[6],roughness:.08,metalness:0,transparent:true,opacity:.5,clearcoat:1,emissive:d[6],emissiveIntensity:0});
 const b=new THREE.Mesh(bg,glass);b.castShadow=true;g.add(b);g.add(new THREE.Mesh(lg,M(LQ[d[2]]||0xb5651d,.2)));
 const lab=new THREE.Mesh(new THREE.CylinderGeometry(.225,.225,.3,28,1,true,-Math.PI/2),new THREE.MeshStandardMaterial({map:LT(d),roughness:.8}));lab.position.y=.4;g.add(lab);
 const cap=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.06,16),M(0xc9a24a,.3,.8));cap.position.y=1.24;g.add(cap);
 g.userData={i,home:g.position.clone(),mat:glass,sel:false,hid:false,room:lib?1:0};g.children.forEach(c=>c.userData.root=g);B.push(g);
});
// bear
const bear=new THREE.Group();bear.position.set(0,1.1,-.6);S.add(bear);
const fur=M(0x6b4222,.95),dk=M(0x2a170a,.9),blk=M(0x0e0e10,.7);
const body=add(new THREE.SphereGeometry(.85,32,24),fur,0,.9,0,bear);body.scale.set(1.05,1.25,.8);
add(new THREE.CylinderGeometry(.62,.8,1.0,24),blk,0,.7,.05,bear);
add(new THREE.BoxGeometry(.9,1.05,.06),M(0x222226,.8),0,.55,.45,bear);
add(new THREE.BoxGeometry(.35,.08,.03),M(0xb22,.6),0,1.2,.5,bear);
const head=new THREE.Group();head.position.y=2.0;bear.add(head);
add(new THREE.SphereGeometry(.5,32,24),fur,0,0,0,head);
add(new THREE.SphereGeometry(.2,20,16),fur,-.38,.42,0,head);add(new THREE.SphereGeometry(.2,20,16),fur,.38,.42,0,head);
add(new THREE.SphereGeometry(.1,12,10),dk,-.38,.42,.1,head);add(new THREE.SphereGeometry(.1,12,10),dk,.38,.42,.1,head);
const sn=add(new THREE.SphereGeometry(.24,24,18),M(0xb88a5a,.9),0,-.12,.4,head);sn.scale.set(1,.8,1);
add(new THREE.SphereGeometry(.07,16,12),M(0x050505,.3),0,-.04,.62,head);
const eyes=[-.17,.17].map(x=>add(new THREE.SphereGeometry(.055,16,12),M(0x050505,.1),x,.1,.44,head));
// arms
const arms=[-1,1].map(s=>{const a=new THREE.Group();a.position.set(s*.95,1.8,0);bear.add(a);
 add(new THREE.CylinderGeometry(.2,.17,1,12),fur,0,-.5,0,a);a.rotation.z=s*.25;a.rotation.x=-.5;return a});
// interaction
const ray=new THREE.Raycaster(),mp=new THREE.Vector2(9,9);let hov=null,sel=null,t0=0,started=false,t=0,mx=0;
addEventListener('pointermove',e=>{mp.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);mx=mp.x});
const keys={};let yaw=0,pitch=0,drag=false,dist=3,greetT=0,seen=false,down=[0,0];const P=new THREE.Vector3(),T3=new THREE.Vector3(),dummy=new THREE.Object3D(),VS=new THREE.Vector3(0,1.6,1.6);
addEventListener('keydown',e=>{keys[e.code]=1;if(e.code=='Escape')closeP()});addEventListener('keyup',e=>keys[e.code]=0);
R.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];drag=true});addEventListener('pointerup',()=>drag=false);
addEventListener('pointermove',e=>{if(!drag||!started)return;if(sel){sel.rotation.y+=(e.movementX||0)*.01}else{yaw-=(e.movementX||0)*.004;pitch=Math.max(-1,Math.min(1,pitch-(e.movementY||0)*.004))}});
addEventListener('wheel',e=>{if(sel)dist=Math.max(1.8,Math.min(6,dist+e.deltaY*.003))},{passive:true});
addEventListener('click',e=>{if(!started||e.target.closest('#panel,#bar,#title')||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;pick()});
function pick(){ray.setFromCamera(mp,C);const h=ray.intersectObjects(B.filter(b=>b.userData.room==room).flatMap(b=>b.children))[0];if(h&&!h.object.userData.root.userData.hid){choose(h.object.userData.root)}}
const E=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
function choose(g){if(sel)sel.userData.sel=false;sel=g;g.userData.sel=true;dist=3;const i=g.userData.i,d=D[i];track('view','product',D[i][7]);if(TK)api('/products/'+D[i][7]).then(sync).catch(()=>{});
 const p=document.getElementById('panel');
 p.innerHTML=`${d[8]?`<img src="${E(d[8])}" alt="${E(d[0]+' '+d[1])}" style="width:100%;max-height:230px;object-fit:contain;background:#0007;margin-bottom:8px">`:''}<h2>${E(d[0])}</h2><p style="margin:2px 0 10px;font-style:italic">${E(d[1])}</p><dl><dt>Category</dt><dd>${E(d[2])}</dd><dt>Origin</dt><dd>${E(d[3])}</dd><dt>ABV</dt><dd>${E(d[5])}</dd><dt>Bottle</dt><dd>3D model is a stylised generic bottle in the product’s colour palette, not a licensed replica.</dd></dl><p style="line-height:1.5">${E(d[4])}</p><small>${d[8]?'Photo: '+E(d[9]||'source not recorded')+' ':''}Educational information only. Facts are limited to widely documented points; check the label for exact product details. Please drink responsibly.</small><div id="shop"></div><button onclick="fav(${i})">${FV.includes(i)?'★ SAVED':'☆ FAVORITE'}</button><button onclick="closeP()">CLOSE</button><small>Recently viewed: ${RC.filter(x=>x>=0).map(x=>E(D[x][0])).join(', ')}</small>`;
 p.classList.add('show');if(window.Shop)Shop.renderBuy(D[i][7],document.getElementById('shop'))}
window.closeP=()=>{if(sel)sel.userData.sel=false;sel=null;document.getElementById('panel').classList.remove('show')};
function apply(){const q=document.getElementById('q').value.toLowerCase();B.forEach(g=>{const d=D[g.userData.i];const m=(filt=='All'||d[2]==filt||(filt=='Favorites'&&FV.includes(g.userData.i)))&&(cn.value=='All'||d[3]==cn.value)&&d.slice(0,4).join(' ').toLowerCase().includes(q);g.userData.hid=!m;g.visible=m})}
document.getElementById('q').oninput=apply;
document.getElementById('yes').onclick=()=>{document.getElementById('gate').remove();start=performance.now();intro=true;greetT=t+9};
document.getElementById('go').onclick=()=>{started=true;P.copy(C.position);document.getElementById('title').style.display='none';bar.hidden=false};
let intro=false,start=0;
function loop(now){requestAnimationFrame(loop);const pt=t;t=now/1000;const dt=Math.min(.05,t-pt);
 // intro dolly
 if(intro&&!started){const k=Math.min((now-start)/5000,1),e=1-Math.pow(1-k,3);C.position.z=16-e*8.5;C.position.y=1.7+e*.1;if(k>.7)document.getElementById('title').style.opacity=1}
 if(started){const sp=(keys.ShiftLeft?4:2.4)*dt,f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
 if(!sel){P.x+=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*sp;P.z+=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*sp;P.x=Math.max(ox-6.3,Math.min(ox+6.3,P.x));P.z=Math.max(-2.4,Math.min(12,P.z));
  if(!room&&Math.abs(P.x)<5&&P.z>-.6&&P.z<1.8)P.z=P.z>.6?1.8:-.6;if(room&&Math.abs(P.x-ox)<3.1&&Math.abs(P.z-5)<1.2)P.z=P.z>5?6.2:3.8;P.y=1.7;if(!seen&&P.z<4.8){seen=true;greetT=t+3}}
 const tp=sel?T3.set(ox,2.4,1.6+dist):P;
 if(sel){dummy.position.copy(tp);dummy.lookAt(ox,2.5,1.6)}else dummy.rotation.set(pitch,yaw,0,'YXZ');
 const k=sel?.06:.3;C.position.lerp(tp,k);C.quaternion.slerp(dummy.quaternion,k)}
 if(!started)C.lookAt(0,2,-1.5);
 // bear idle
 const br=Math.sin(t*1.6)*.02;body.scale.y=1.25+br;{const tx=sel?sel.userData.home.x:P.x,tz=sel?-3.2:P.z,ty=started||sel?Math.max(-1.1,Math.min(1.1,Math.atan2(tx,tz+.6))):Math.sin(t*.5)*.25;head.rotation.y+=(ty-head.rotation.y)*.08}head.rotation.x=Math.sin(t*.7)*.04;
 const bl=(t%4<.15)?.1:1;eyes.forEach(e=>e.scale.y=bl);
 {const tz=sel?1.6:t<greetT?1.15+Math.sin(t*6)*.35:.25;arms[1].rotation.z+=(tz-arms[1].rotation.z)*.12;arms[1].rotation.x+=((sel?-.7:-.5)-arms[1].rotation.x)*.1}
 // hover
 ray.setFromCamera(mp,C);const h=started?ray.intersectObjects(B.filter(b=>!b.userData.hid&&b.userData.room==room).flatMap(b=>b.children))[0]:null;hov=h?h.object.userData.root:null;document.body.style.cursor=hov?'pointer':'';
 B.forEach(g=>{const u=g.userData;u.mat.emissiveIntensity+=((g===hov||u.sel?.45:0)-u.mat.emissiveIntensity)*.15;
  const tgt=u.sel?VS:u.home;g.position.lerp(tgt,.08);const s=u.sel?1.7:1;g.scale.lerp(new THREE.Vector3(s,s,s),.08);if(u.sel){if(!drag)g.rotation.y+=.006}else g.rotation.y*=.9});
 R.render(S,C)}
requestAnimationFrame(loop);
addEventListener('resize',()=>{R.setSize(innerWidth,innerHeight);C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix()});
