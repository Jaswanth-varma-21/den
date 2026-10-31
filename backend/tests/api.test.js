import {test,before,after} from 'node:test';import assert from 'node:assert/strict';
process.env.JWT_SECRET||='test-secret-test-secret-test-secret-1234';process.env.BCRYPT_ROUNDS||='4';
process.env.RATE_MAX='100000';process.env.AUTH_RATE_MAX='100000';process.env.ADMIN_EMAIL='admin@bearsden.local';process.env.ADMIN_PASSWORD='AdminPass12345';
process.env.UPLOAD_DIR='/tmp/bd-uploads-test';
const {default:app}=await import('../src/app.js');const {pool,q}=await import('../src/db/pool.js');const {migrate}=await import('../src/db/migrate.js');const {seed}=await import('../src/db/seed.js');const {importPhotos}=await import('../src/db/importPhotos.js');
let srv,base;const stamp=Date.now();const U={email:`u${stamp}@test.com`,username:'tester',password:'Passw0rdTest'};let userTok,adminTok;
const call=async(m,p,{tok,body,form}={})=>{const h={};if(tok)h.Authorization='Bearer '+tok;if(body)h['Content-Type']='application/json';
 const r=await fetch(base+p,{method:m,headers:h,body:form||(body?JSON.stringify(body):undefined)});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t}return {s:r.status,j,h:r.headers}};
before(async()=>{await migrate();await seed();await importPhotos();await new Promise(r=>{srv=app.listen(0,r)});base=`http://localhost:${srv.address().port}`;
 adminTok=(await call('POST','/api/auth/login',{body:{email:'admin@bearsden.local',password:'AdminPass12345'}})).j.token});
after(async()=>{srv.close();await pool.end()});

test('database connection + health',async()=>{const r=await call('GET','/api/health');assert.equal(r.s,200);assert.equal(r.j.db,'up')});
test('security headers present',async()=>{const r=await call('GET','/api/health');assert.ok(r.h.get('content-security-policy'));assert.equal(r.h.get('x-content-type-options'),'nosniff');assert.equal(r.h.get('x-powered-by'),null)});
test('register validation, success, duplicate',async()=>{
 assert.equal((await call('POST','/api/auth/register',{body:{...U,password:'short'}})).s,400);
 assert.equal((await call('POST','/api/auth/register',{body:{...U,password:'onlyletters'}})).s,400);
 const r=await call('POST','/api/auth/register',{body:U});assert.equal(r.s,201);assert.ok(r.j.token);assert.equal(r.j.user.role,'user');userTok=r.j.token;
 assert.equal((await call('POST','/api/auth/register',{body:U})).s,409);
 const h=(await q('SELECT password_hash FROM users WHERE email=$1',[U.email])).rows[0].password_hash;assert.ok(h.startsWith('$2')&&!h.includes(U.password))});
test('login success/failure and register cannot self-assign admin',async()=>{
 assert.equal((await call('POST','/api/auth/login',{body:{email:U.email,password:'wrongpass1'}})).s,401);
 assert.equal((await call('POST','/api/auth/login',{body:{email:'nobody@test.com',password:'wrongpass1'}})).s,401);
 assert.equal((await call('POST','/api/auth/login',{body:{email:U.email,password:U.password}})).s,200);
 const r=await call('POST','/api/auth/register',{body:{email:`x${stamp}@test.com`,username:'sneaky',password:'Passw0rdTest',role:'admin'}});assert.equal(r.j.user.role,'user')});
test('protected routes, tampered token, logout invalidates token',async()=>{
 assert.equal((await call('GET','/api/auth/me')).s,401);assert.equal((await call('GET','/api/auth/me',{tok:userTok+'x'})).s,401);
 assert.equal((await call('GET','/api/auth/me',{tok:userTok})).s,200);
 const t=(await call('POST','/api/auth/login',{body:{email:U.email,password:U.password}})).j.token;
 assert.equal((await call('POST','/api/auth/logout',{tok:t})).s,204);assert.equal((await call('GET','/api/auth/me',{tok:t})).s,401);
 assert.equal((await call('GET','/api/auth/me',{tok:userTok})).s,200,'other tokens unaffected')});
test('role-based authorization',async()=>{
 const b={name:'X',countryId:1,categoryId:1};
 assert.equal((await call('POST','/api/brands',{body:b})).s,401);assert.equal((await call('POST','/api/brands',{tok:userTok,body:b})).s,403);
 assert.equal((await call('GET','/api/admin/users',{tok:userTok})).s,403);assert.equal((await call('GET','/api/admin/analytics',{tok:userTok})).s,403);
 assert.equal((await call('GET','/api/admin/users',{tok:adminTok})).s,200)});
test('brand CRUD',async()=>{
 const co=(await call('GET','/api/countries')).j.items.find(c=>c.name==='Scotland'),ca=(await call('GET','/api/categories')).j.items.find(c=>c.slug==='whisky');
 assert.equal((await call('POST','/api/brands',{tok:adminTok,body:{countryId:co.id,categoryId:ca.id}})).s,400);
 const c=await call('POST','/api/brands',{tok:adminTok,body:{name:`Test Brand ${stamp}`,countryId:co.id,categoryId:ca.id,description:'Test'}});assert.equal(c.s,201);const id=c.j.id;
 assert.equal((await call('POST','/api/brands',{tok:adminTok,body:{name:`test brand ${stamp}`,countryId:co.id,categoryId:ca.id}})).s,409,'case-insensitive unique');
 assert.equal((await call('POST','/api/brands',{tok:adminTok,body:{name:'Bad FK',countryId:99999,categoryId:ca.id}})).s,400);
 const u=await call('PUT','/api/brands/'+id,{tok:adminTok,body:{description:'Updated',foundedYear:1900}});assert.equal(u.s,200);assert.equal(u.j.description,'Updated');
 assert.equal((await call('POST',`/api/brands/${id}/history`,{tok:adminTok,body:{year:1900,event:'Founded'}})).s,201);
 assert.equal((await call('GET','/api/brands/'+id)).j.history.length,1);
 assert.equal((await call('DELETE','/api/brands/'+id,{tok:adminTok})).s,204);assert.equal((await call('GET','/api/brands/'+id)).s,404);
 assert.equal((await call('GET','/api/brands/abc')).s,400)});
test('product CRUD, variants, related',async()=>{
 const b=(await call('GET','/api/brands?q=glenfiddich')).j.items[0];
 const body={brandId:b.id,categoryId:b.categoryId,countryId:b.countryId,name:`Test Expr ${stamp}`,abv:43,specs:{age:'15'}};
 assert.equal((await call('POST','/api/products',{tok:adminTok,body:{...body,abv:150}})).s,400,'abv out of range');
 const c=await call('POST','/api/products',{tok:adminTok,body});assert.equal(c.s,201);const id=c.j.id;assert.equal(c.j.abv,43);assert.equal(c.j.specs.age,'15');
 assert.equal((await call('POST','/api/products',{tok:adminTok,body})).s,409);
 assert.equal((await call('POST','/api/products',{tok:adminTok,body:{...body,name:'urlbad',modelUrl:'javascript:alert(1)'}})).s,400);
 const u=await call('PUT','/api/products/'+id,{tok:adminTok,body:{abv:null,abvNote:'Varies',description:'D'}});assert.equal(u.j.abv,null);assert.equal(u.j.specs.age,'15','specs untouched on partial update');
 const v=await call('POST',`/api/products/${id}/variants`,{tok:adminTok,body:{name:'700ml',sizeMl:700}});assert.equal(v.s,201);
 const g=await call('GET','/api/products/'+id);assert.equal(g.j.variants.length,1);assert.ok(g.j.related.length>0&&g.j.related.every(r=>r.id!==id));
 assert.equal((await call('DELETE',`/api/products/${id}/variants/${v.j.id}`,{tok:adminTok})).s,204);
 assert.equal((await call('DELETE','/api/products/'+id,{tok:adminTok})).s,204);assert.equal((await call('GET','/api/products/'+id)).s,404)});
test('search, filters, pagination, sorting',async()=>{
 const g=await call('GET','/api/products?q=glen');assert.deepEqual(g.j.items.map(p=>p.brand).sort(),['Glenfiddich','The Glenlivet']);
 const sc=await call('GET','/api/products?country=Scotland&limit=100');assert.ok(sc.j.total>=5&&sc.j.items.every(p=>p.country==='Scotland'));
 const wh=await call('GET','/api/products?category=whisky&limit=100');assert.equal(wh.j.total,12);
 const both=await call('GET','/api/products?category=whisky&country=Japan');assert.deepEqual(both.j.items.map(p=>p.brand).sort(),['Hibiki','Yamazaki']);
 const p2=await call('GET','/api/products?limit=5&page=2');assert.equal(p2.j.items.length,5);assert.equal(p2.j.page,2);assert.equal(p2.j.total,25);assert.equal(p2.j.pages,5);
 const s=await call('GET','/api/products?sort=name&dir=desc&limit=100').then(r=>r.j.items.map(p=>p.name));const dbOrder=(await q('SELECT name FROM products ORDER BY name DESC,id')).rows.map(r=>r.name);assert.deepEqual(s,dbOrder);assert.ok(s.length>=24);
 assert.equal((await call('GET','/api/products?sort=evil;drop')).s,400);assert.equal((await call('GET','/api/products?limit=1000')).s,400);
 const br=await call('GET','/api/brands?category=gin');assert.ok(br.j.items.length>=2&&br.j.items.every(b=>b.category==='Gin'));
 const all=await call('GET','/api/search?q=jack');assert.equal(all.j.brands[0].name,'Jack Daniel’s');assert.ok(all.j.products.length>=1);
 const inj=await call('GET','/api/products?q='+encodeURIComponent("'; DROP TABLE products;--"));assert.equal(inj.s,200);assert.equal(inj.j.total,0);
 assert.equal((await q('SELECT count(*)::int n FROM products')).rows[0].n>=24,true,'table intact');
 const pct=await call('GET','/api/products?q='+encodeURIComponent('%'));assert.equal(pct.j.total,0,'LIKE wildcard escaped')});
test('user favorites, recent, collections persisted in PostgreSQL',async()=>{
 const ps=(await call('GET','/api/products?limit=3')).j.items;
 assert.equal((await call('PUT','/api/me/favorites/products/'+ps[0].id,{tok:userTok})).s,204);assert.equal((await call('PUT','/api/me/favorites/products/'+ps[0].id,{tok:userTok})).s,204,'idempotent');
 assert.equal((await call('PUT','/api/me/favorites/products/999999',{tok:userTok})).s,400);
 assert.equal((await call('PUT','/api/me/favorites/brands/'+ps[1].brandId,{tok:userTok})).s,204);
 let f=(await call('GET','/api/me/favorites',{tok:userTok})).j;assert.equal(f.products.length,1);assert.equal(f.brands.length,1);
 const uid=(await call('GET','/api/auth/me',{tok:userTok})).j.user.id;assert.equal((await q('SELECT count(*)::int n FROM favorite_products WHERE user_id=$1',[uid])).rows[0].n,1);
 assert.equal((await call('DELETE','/api/me/favorites/products/'+ps[0].id,{tok:userTok})).s,204);assert.equal((await call('GET','/api/me/favorites',{tok:userTok})).j.products.length,0);
 await call('GET','/api/products/'+ps[2].id,{tok:userTok});await call('GET','/api/products/'+ps[1].id,{tok:userTok});
 const rc=(await call('GET','/api/me/recent',{tok:userTok})).j.items;assert.deepEqual(rc.map(r=>r.id),[ps[1].id,ps[2].id]);
 const c=await call('POST','/api/me/collections',{tok:userTok,body:{name:'My Picks'}});assert.equal(c.s,201);assert.equal((await call('POST','/api/me/collections',{tok:userTok,body:{name:'My Picks'}})).s,409);
 assert.equal((await call('PUT',`/api/me/collections/${c.j.id}/items/${ps[0].id}`,{tok:userTok})).s,204);
 assert.equal((await call('GET','/api/me/collections',{tok:userTok})).j.items[0].products.length,1);
 const other=(await call('POST','/api/auth/register',{body:{email:`o${stamp}@test.com`,username:'other',password:'Passw0rdTest'}})).j.token;
 assert.equal((await call('DELETE','/api/me/collections/'+c.j.id,{tok:other})).s,404,'cannot delete another user collection');
 assert.equal((await call('DELETE','/api/me/collections/'+c.j.id,{tok:userTok})).s,204)});
const fd=(name,bytes,type='application/octet-stream')=>{const f=new FormData();f.set('file',new Blob([bytes],{type}),name);return f};
test('asset upload validation and secure serving',async()=>{
 const glb=Buffer.concat([Buffer.from('glTF'),Buffer.alloc(40)]);const pid=(await call('GET','/api/products?limit=1')).j.items[0].id;
 assert.equal((await call('POST','/api/admin/assets?kind=bottle_model',{tok:userTok,form:fd('a.glb',glb)})).s,403);
 assert.equal((await call('POST','/api/admin/assets?kind=nope',{tok:adminTok,form:fd('a.glb',glb)})).s,400);
 const ok=await call('POST','/api/admin/assets?kind=bottle_model&productId='+pid,{tok:adminTok,form:fd('bottle.glb',glb)});assert.equal(ok.s,201);assert.equal(ok.j.mime,'model/gltf-binary');
 assert.equal((await call('GET','/api/products/'+pid)).j.modelUrl,ok.j.url);
 const got=await fetch(base+ok.j.url);assert.equal(got.status,200);assert.equal(got.headers.get('content-type'),'model/gltf-binary');assert.equal(got.headers.get('x-content-type-options'),'nosniff');
 assert.equal((await call('POST','/api/admin/assets?kind=bottle_model',{tok:adminTok,form:fd('fake.glb',Buffer.from('not a model'))})).s,415,'magic bytes');
 assert.equal((await call('POST','/api/admin/assets?kind=bottle_model',{tok:adminTok,form:fd('x.exe',glb)})).s,415,'extension');
 const big=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47]),Buffer.alloc(3e6)]);assert.equal((await call('POST','/api/admin/assets?kind=thumbnail',{tok:adminTok,form:fd('big.png',big)})).s,413,'size limit');
 assert.equal((await call('GET','/api/assets/file/..%2f..%2fetc%2fpasswd')).s,404);assert.equal((await call('GET','/api/assets/file/'+'0'.repeat(36)+'.glb')).s,404)});
test('analytics tracking and admin summary',async()=>{
 const sid='sess-'+stamp,pid=(await call('GET','/api/products?q=hennessy')).j.items[0].id;
 assert.equal((await call('POST','/api/track',{body:{type:'visit',sessionId:sid}})).s,202);assert.equal((await call('POST','/api/track',{body:{type:'view',entityType:'product',entityId:pid,sessionId:sid}})).s,202);
 assert.equal((await call('POST','/api/track',{body:{type:'hack'}})).s,400);await call('GET','/api/products?q=hennessy');await new Promise(r=>setTimeout(r,200));
 const a=(await call('GET','/api/admin/analytics',{tok:adminTok})).j;assert.ok(a.totalVisitors>=1);assert.ok(a.mostViewedProducts.some(p=>p.id===pid));assert.ok(a.popularCategories.some(c=>c.name==='Cognac'));assert.ok(a.topSearches.some(s=>s.term==='hennessy'));
 assert.equal((await q(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='user_activity' AND column_name IN('ip','user_agent')`)).rows[0].n,0,'no IP/UA collected')});
test('frontend ↔ backend integration',async()=>{
 const html=(await call('GET','/')).j;assert.match(html,/\/api\/products/);assert.match(html,/THE BEAR’S DEN/);
 assert.equal((await fetch(base+'/app.js')).status,200);assert.equal((await fetch(base+'/admin.html')).status,200);
 const r=await call('GET','/api/products?limit=100&sort=id');assert.equal(r.j.items.length>=24,true);
 for(const k of ['id','brand','name','category','country','description','abv','abvNote','color'])assert.ok(k in r.j.items[0],k);
 assert.equal(r.j.items[0].brand,'Johnnie Walker');assert.equal(r.j.items.slice(0,24).filter(p=>p.category==='Whisky').length,12);
 const app=(await call('GET','/app.js')).j;assert.ok(!/const D=\[\[/.test(app),'no hardcoded product array in frontend');assert.doesNotMatch(app,/localStorage.(get|set)Item\('(fv|rc)'/)});
test('malformed JSON and unknown API route handled safely',async()=>{
 const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'});assert.equal(r.status,400);
 const n=await call('GET','/api/nope');assert.equal(n.s,404);assert.ok(!JSON.stringify(n.j).includes('at '))});

test('real bottle photos are linked, served, and carry licence metadata',async()=>{
 const p=(await call('GET','/api/products?q=red label')).j.items.find(x=>x.brand==='Johnnie Walker');assert.ok(p.bottleImageUrl);assert.match(p.imageNote,/not verified/);
 const img=await fetch(base+p.bottleImageUrl);assert.equal(img.status,200);assert.equal(img.headers.get('content-type'),'image/jpeg');const b=Buffer.from(await img.arrayBuffer());assert.ok(b.length>2000&&b[0]===0xff&&b[1]===0xd8);
 const d=(await call('GET','/api/products/'+p.id)).j;const th=d.assets.find(a=>a.kind==='thumbnail');assert.equal(th.license,'unverified (supplied by project owner)');assert.ok(th.attribution);
 const all=(await call('GET','/api/products?limit=100')).j.items;assert.equal(all.filter(x=>x.bottleImageUrl).length,13);
 const bb=all.find(x=>x.name.startsWith('Broken Bat'));assert.equal(bb.brand,'Greater Than');assert.equal(bb.country,'India');assert.equal(bb.category,'Gin');assert.equal(bb.abv,47);assert.equal(bb.specs.volume_ml,700);
 const n1=(await q('SELECT count(*)::int n FROM assets')).rows[0].n;await importPhotos();assert.equal((await q('SELECT count(*)::int n FROM assets')).rows[0].n,n1,'import is idempotent')});
test('frontend panel shows photo and escapes database text',async()=>{const a=(await call('GET','/app.js')).j;assert.match(a,/d\[8\]\?`<img/);assert.match(a,/E\(d\[4\]\)/);const h=(await call('GET','/')).j;assert.match(h,/bottleImageUrl/)});
