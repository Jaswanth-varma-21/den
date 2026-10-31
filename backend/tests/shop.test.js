import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import fs from 'node:fs';import path from 'node:path';
import jsQR from 'jsqr';import {PNG} from 'pngjs';
Object.assign(process.env,{JWT_SECRET:process.env.JWT_SECRET||'test-secret-test-secret-test-secret-1234',BCRYPT_ROUNDS:'4',RATE_MAX:'100000',AUTH_RATE_MAX:'100000',CHECKOUT_RATE_MAX:'100000',ADMIN_EMAIL:'admin@bearsden.local',ADMIN_PASSWORD:'AdminPass12345',PUBLIC_BASE_URL:'https://bears-den.example.com',UPLOAD_DIR:'/tmp/bd-uploads-test'});
delete process.env.DEMO_TAX_BP;delete process.env.DEMO_SESSION_TTL_MIN;
const {default:app}=await import('../src/app.js');const {pool,q}=await import('../src/db/pool.js');const {migrate}=await import('../src/db/migrate.js');const {seed}=await import('../src/db/seed.js');const {seedPrices}=await import('../src/db/seedPrices.js');
let srv,base,adm,jw,hein,henn;const tok=()=>randomBytes(24).toString('hex');
const call=async(m,p,{t,g,body}={})=>{const h={};if(t)h.Authorization='Bearer '+t;if(g)h['X-Guest-Token']=g;if(body!==undefined)h['Content-Type']='application/json';
 const r=await fetch(base+p,{method:m,headers:h,body:body!==undefined?JSON.stringify(body):undefined});const x=await r.text();let j;try{j=JSON.parse(x)}catch{j=x}return {s:r.status,j,h:r.headers}};
const price=(id,priceMinor,o={})=>call('PUT',`/api/admin/products/${id}/price`,{t:adm,body:{priceMinor,currency:'INR',discountBp:0,status:'available',...o}});
const find=async(qs,brand)=>(await call('GET','/api/products?limit=100&q='+encodeURIComponent(qs))).j.items.find(p=>p.brand===brand).id;
before(async()=>{await migrate();await seed();await seedPrices();await new Promise(r=>{srv=app.listen(0,r)});base=`http://localhost:${srv.address().port}`;
 adm=(await call('POST','/api/auth/login',{body:{email:'admin@bearsden.local',password:'AdminPass12345'}})).j.token;
 jw=await find('red label','Johnnie Walker');hein=await find('Heineken','Heineken');henn=await find('Hennessy','Hennessy');
 assert.equal((await price(jw,350000)).s,200);assert.equal((await price(hein,25000,{discountBp:1000})).s,200);assert.equal((await price(henn,450055)).s,200)});
after(async()=>{srv.close();await pool.end()});
const G=tok();let itemJw,itemHein,order;

test('1. add a bottle to the cart (guest, persisted in PostgreSQL)',async()=>{
 assert.equal((await call('POST','/api/cart/items',{body:{productId:jw}})).s,400,'guest token required');
 const r=await call('POST','/api/cart/items',{g:G,body:{productId:jw,quantity:1}});assert.equal(r.s,201);assert.equal(r.j.items.length,1);assert.equal(r.j.items[0].unitMinor,350000);assert.equal(r.j.demo,true);assert.match(r.j.notice,/DEMO PRICES/);itemJw=r.j.items[0].id;
 assert.equal((await call('GET','/api/cart',{g:G})).j.items.length,1);assert.equal((await call('GET','/api/cart',{g:tok()})).j.items.length,0,'other guest sees an empty cart');
 assert.equal((await q('SELECT count(*)::int n FROM carts WHERE guest_token=$1',[G])).rows[0].n,1)});
test('2. add multiple bottles; adding the same bottle increments',async()=>{
 const a=await call('POST','/api/cart/items',{g:G,body:{productId:hein,quantity:3}});assert.equal(a.j.items.length,2);itemHein=a.j.items.find(i=>i.productId===hein).id;
 const b=await call('POST','/api/cart/items',{g:G,body:{productId:jw,quantity:1}});assert.equal(b.j.items.find(i=>i.productId===jw).quantity,2);assert.equal(b.j.items.length,2)});
test('3. update quantities (and reject invalid ones)',async()=>{
 let r=await call('PUT','/api/cart/items/'+itemJw,{g:G,body:{quantity:3}});assert.equal(r.j.items.find(i=>i.id===itemJw).quantity,3);
 r=await call('PUT','/api/cart/items/'+itemJw,{g:G,body:{quantity:2}});assert.equal(r.j.items.find(i=>i.id===itemJw).quantity,2);
 for(const quantity of [0,21,-1,1.5,'2'])assert.equal((await call('PUT','/api/cart/items/'+itemJw,{g:G,body:{quantity}})).s,400,String(quantity));
 assert.equal((await call('PUT','/api/cart/items/'+itemJw,{g:tok(),body:{quantity:2}})).s,404,'cannot edit another cart')});
test('4. remove products',async()=>{
 const add=await call('POST','/api/cart/items',{g:G,body:{productId:henn}});const id=add.j.items.find(i=>i.productId===henn).id;assert.equal(add.j.items.length,3);
 assert.equal((await call('DELETE','/api/cart/items/'+id,{g:tok()})).s,404,'other guest cannot remove it');
 const r=await call('DELETE','/api/cart/items/'+id,{g:G});assert.equal(r.s,200);assert.equal(r.j.items.length,2);assert.equal((await call('DELETE','/api/cart/items/'+id,{g:G})).s,404)});
test('5+6. subtotal, demo tax and total are computed on the backend in integer paise',async()=>{
 const c=(await call('GET','/api/cart',{g:G})).j;// 2 x 350000 + 3 x (25000 less 10%)
 assert.equal(c.items.find(i=>i.productId===hein).unitMinor,22500);assert.equal(c.subtotalMinor,767500);assert.equal(c.taxBp,1800);assert.equal(c.taxMinor,138150);assert.equal(c.totalMinor,905650);assert.equal(c.currency,'INR');
 const p=(await call('GET','/api/products/'+hein)).j;assert.deepEqual([p.price.priceMinor,p.price.discountBp,p.price.displayMinor,p.price.demo,p.availability],[25000,1000,22500,true,'available'])});
test('7. generate a demo QR code that encodes only the site\'s own confirmation URL',async()=>{
 assert.equal((await call('POST','/api/demo-checkout',{g:tok(),body:{}})).s,400,'empty cart cannot check out');
 assert.equal((await call('POST','/api/demo-checkout',{g:G,body:{customerName:'x'.repeat(81)}})).s,400);assert.equal((await call('POST','/api/demo-checkout',{g:G,body:{total:1}})).s,400,'unknown fields rejected');
 const r=await call('POST','/api/demo-checkout',{g:G,body:{customerName:'Asha'}});assert.equal(r.s,201);order=r.j;
 assert.equal(order.sessionId.length,43);assert.match(order.reference,/^DEMO-[0-9A-F]{8}$/);assert.equal(order.totalMinor,905650);assert.ok(order.qrSvg.includes('<svg'));
 assert.equal(order.confirmUrl,'https://bears-den.example.com/demo-payment/'+order.sessionId);
 const png=await fetch(base+`/api/demo-checkout/${order.sessionId}/qr.png`);assert.equal(png.headers.get('content-type'),'image/png');
 const img=PNG.sync.read(Buffer.from(await png.arrayBuffer()));const dec=jsQR(new Uint8ClampedArray(img.data),img.width,img.height);
 assert.equal(dec.data,order.confirmUrl,'QR decodes to the confirmation URL');assert.doesNotMatch(dec.data,/^upi:|pa=|@|\?/i);
 const again=await call('POST','/api/demo-checkout',{g:G,body:{}});assert.notEqual(again.j.sessionId,order.sessionId,'unique tokens');
 const ttl=(new Date(order.expiresAt)-Date.now())/60000;assert.ok(ttl>29&&ttl<=30.1,'default 30 minute expiry')});
test('8. scanning on another device: a fresh client with no cookies or tokens can open the QR URL',async()=>{
 // Simulation: a physical phone scan was NOT performed. A brand-new HTTP client follows the exact QR path.
 const page=await fetch(base+new URL(order.confirmUrl).pathname);assert.equal(page.status,200);assert.match(page.headers.get('content-type'),/text\/html/);
 assert.equal((await call('GET',`/api/demo-checkout/${order.sessionId}/status`)).j.status,'pending');
 const o=await call('GET','/api/demo-checkout/'+order.sessionId);assert.equal(o.s,200);assert.equal(o.j.reference,order.reference);assert.equal(o.j.status,'scanned');
 assert.equal((await call('GET',`/api/demo-checkout/${order.sessionId}/status`)).j.status,'scanned')});
test('9. thank-you page content, completion, no "Payment Successful"',async()=>{
 const html=await (await fetch(base+'/demo-payment/'+order.sessionId)).text();
 for(const s of ['THANK YOU FOR VISITING!','Your virtual bar experience was wonderful.','THIS WAS A DEMONSTRATION CHECKOUT.','RETURN TO THE BAR','Golden bear'])assert.ok(html.includes(s),s);assert.doesNotMatch(html,/payment\s+successful/i);
 const r=await call('POST',`/api/demo-checkout/${order.sessionId}/complete-demo`);assert.equal(r.s,200);assert.equal(r.j.status,'confirmed');assert.match(r.j.notice,/DEMONSTRATION CHECKOUT/);assert.doesNotMatch(JSON.stringify(r.j),/payment\s+successful/i);
 assert.equal((await call('POST',`/api/demo-checkout/${order.sessionId}/complete-demo`)).s,200,'idempotent');assert.equal((await call('GET','/api/cart',{g:G})).j.items.length,0,'cart cleared after demo confirmation')});
test('10. no real payment is processed or collected',async()=>{
 const cols=(await q(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN('demo_orders','demo_order_items','carts','cart_items','product_prices')`)).rows.map(r=>r.column_name);
 assert.ok(cols.length>20);assert.deepEqual(cols.filter(c=>/card|cvv|upi|bank|iban|account|payment|vpa/i.test(c)),[],'no payment-credential columns');
 const files=[];(function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){if(f.name==='node_modules'||f.name==='uploads'||f.name==='tests')continue;const p=path.join(d,f.name);f.isDirectory()?walk(p):/\.(js|html|sql)$/.test(f.name)&&files.push(p)}})(path.resolve('..'));
 for(const f of files)assert.doesNotMatch(fs.readFileSync(f,'utf8'),/stripe|razorpay|paypal|paytm|cashfree|upi:\/\//i,f);
 const o=(await q('SELECT * FROM demo_orders WHERE reference=$1',[order.reference])).rows[0];assert.equal(o.status,'confirmed');assert.ok(!Object.keys(o).some(k=>/card|upi|bank|payment/i.test(k)))});
test('11. expired QR sessions are rejected',async()=>{
 const s=(await call('POST','/api/demo-checkout',{g:await(async()=>{const g=tok();await call('POST','/api/cart/items',{g,body:{productId:jw}});return g})(),body:{}})).j.sessionId;
 await q(`UPDATE demo_orders SET expires_at=now()-interval '1 minute' WHERE session_token=$1`,[s]);
 assert.equal((await call('GET','/api/demo-checkout/'+s)).s,410);assert.equal((await call('GET',`/api/demo-checkout/${s}/status`)).j.status,'expired');
 assert.equal((await call('POST',`/api/demo-checkout/${s}/complete-demo`)).s,410);assert.equal((await fetch(base+`/api/demo-checkout/${s}/qr.png`)).status,410);
 assert.equal((await q('SELECT status FROM demo_orders WHERE session_token=$1',[s])).rows[0].status,'pending','expired order never becomes confirmed');
 assert.equal((await call('GET','/api/demo-checkout/abc')).s,404);assert.equal((await call('GET','/api/demo-checkout/'+randomBytes(32).toString('base64url'))).s,404)});
test('12. backend price validation: client prices are rejected and ignored',async()=>{
 const g=tok();for(const body of [{productId:jw,price:1},{productId:jw,unitMinor:1},{productId:jw,quantity:'5'},{productId:jw,quantity:-2},{productId:jw,quantity:99},{productId:'x'}])assert.equal((await call('POST','/api/cart/items',{g,body})).s,400,JSON.stringify(body));
 assert.equal((await call('POST','/api/cart/items',{g,body:{productId:999999}})).s,404);
 await call('POST','/api/cart/items',{g,body:{productId:jw,quantity:1}});assert.equal((await call('GET','/api/cart',{g})).j.subtotalMinor,350000);
 await price(jw,400000);assert.equal((await call('GET','/api/cart',{g})).j.subtotalMinor,400000,'cart follows the admin price');
 const o=(await call('POST','/api/demo-checkout',{g,body:{}})).j;assert.equal(o.subtotalMinor,400000);await price(jw,350000);
 assert.equal((await call('GET','/api/demo-checkout/'+o.sessionId)).j.subtotalMinor,400000,'order keeps its price snapshot');
 const g2=tok();await call('POST','/api/cart/items',{g:g2,body:{productId:henn}});await price(henn,450055,{status:'unavailable'});
 const c=(await call('GET','/api/cart',{g:g2})).j;assert.equal(c.items[0].availability,'unavailable');assert.equal(c.totalMinor,0);assert.equal((await call('POST','/api/demo-checkout',{g:g2,body:{}})).s,409,'unavailable items block checkout');
 assert.equal((await call('POST','/api/cart/items',{g:g2,body:{productId:henn}})).s,409);await price(henn,450055)});
test('13. logged-in carts persist in the database and merge the guest cart',async()=>{
 const email=`shop${Date.now()}@test.com`,u=(await call('POST','/api/auth/register',{body:{email,username:'shopper',password:'Passw0rdTest'}})).j,g=tok();
 await call('POST','/api/cart/items',{g,body:{productId:hein,quantity:2}});
 const merged=await call('GET','/api/cart',{t:u.token,g});assert.equal(merged.j.items[0].quantity,2);
 assert.equal((await q('SELECT count(*)::int n FROM carts WHERE user_id=$1',[u.user.id])).rows[0].n,1);assert.equal((await q('SELECT count(*)::int n FROM carts WHERE guest_token=$1',[g])).rows[0].n,0,'guest cart merged away');
 assert.equal((await call('GET','/api/cart',{t:u.token,g:tok()})).j.items[0].quantity,2,'same cart on another device');
 await call('POST','/api/cart/items',{t:u.token,body:{productId:jw}});assert.equal((await call('GET','/api/cart',{t:u.token})).j.items.length,2);
 assert.equal((await call('DELETE','/api/cart',{t:u.token})).j.items.length,0)});
test('14. admin: pricing, orders, cart activity, popularity (RBAC enforced)',async()=>{
 const u=(await call('POST','/api/auth/register',{body:{email:`n${Date.now()}@test.com`,username:'normal',password:'Passw0rdTest'}})).j.token;
 for(const [m,p] of [['PUT',`/api/admin/products/${jw}/price`],['GET','/api/admin/orders'],['GET','/api/admin/cart-activity'],['GET','/api/admin/popularity']]){assert.equal((await call(m,p,{body:m==='PUT'?{priceMinor:1}:undefined})).s,401);assert.equal((await call(m,p,{t:u,body:m==='PUT'?{priceMinor:1}:undefined})).s,403)}
 for(const body of [{priceMinor:-1},{priceMinor:1.5},{priceMinor:100,discountBp:10001},{priceMinor:100,status:'free'},{priceMinor:100,extra:1}])assert.equal((await call('PUT',`/api/admin/products/${jw}/price`,{t:adm,body})).s,400,JSON.stringify(body));
 assert.equal((await call('PUT','/api/admin/products/999999/price',{t:adm,body:{priceMinor:100}})).s,400);
 const o=(await call('GET','/api/admin/orders',{t:adm})).j.items;assert.ok(o.some(x=>x.reference===order.reference&&x.status==='confirmed'&&x.totalMinor===905650&&x.itemCount===5));assert.ok(o.some(x=>x.status==='expired'));
 const a=(await call('GET','/api/admin/cart-activity',{t:adm})).j;assert.equal(typeof a.activeCarts,'number');assert.ok(a.recent.some(e=>e.type==='demo_confirm')&&a.recent.some(e=>e.type==='cart_add'));
 const p=(await call('GET','/api/admin/popularity',{t:adm})).j.items.find(x=>x.productId===jw);assert.ok(p.cartAdds>=1&&p.unitsOrdered>=2)});
