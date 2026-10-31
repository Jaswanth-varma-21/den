import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import fs from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
Object.assign(process.env,{JWT_SECRET:process.env.JWT_SECRET||'test-secret-test-secret-test-secret-1234',BCRYPT_ROUNDS:'4',RATE_MAX:'100000',AUTH_RATE_MAX:'100000',CHECKOUT_RATE_MAX:'100000',ADMIN_EMAIL:'admin@bearsden.local',ADMIN_PASSWORD:'AdminPass12345',PUBLIC_BASE_URL:'https://bears-den.example.com',UPLOAD_DIR:'/tmp/bd-uploads-test'});
const {default:app}=await import('../src/app.js');const {pool}=await import('../src/db/pool.js');const {migrate}=await import('../src/db/migrate.js');const {seed}=await import('../src/db/seed.js');const {seedPrices}=await import('../src/db/seedPrices.js');
let srv,base,pid;const pub=f=>fs.readFileSync(new URL('../../frontend/public/'+f,import.meta.url),'utf8');
const wait=async(fn,ms=6000)=>{const t=Date.now();for(;;){try{const v=fn();if(v)return v}catch{}if(Date.now()-t>ms)throw new Error('timeout waiting for: '+fn);await new Promise(r=>setTimeout(r,50))}};
const vc=()=>{const v=new VirtualConsole();return v};
const dom=(html,url,o={})=>new JSDOM(html,{url,runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc(),beforeParse(w){w.fetch=(u,i)=>fetch(new URL(u,url),i);o.before?.(w)}});
before(async()=>{await migrate();await seed();await seedPrices();await new Promise(r=>{srv=app.listen(0,r)});base=`http://localhost:${srv.address().port}`;
 pid=(await (await fetch(base+'/api/products?limit=100&q=Heineken')).json()).items[0].id});
after(async()=>{srv.close();await pool.end()});

test('UI: bottle panel add-to-cart, live cart badge, quantity buttons, totals, clear (real shop.js in a simulated browser)',async()=>{
 const d=dom('<div id="bar"></div><div id="shop"></div>',base+'/',{});d.window.eval(pub('shop.js'));const w=d.window,doc=w.document;
 await wait(()=>doc.querySelector('#cart-btn'));assert.equal(doc.querySelector('#cart-btn b').textContent,'0');
 w.Shop.renderBuy(pid,doc.getElementById('shop'));await wait(()=>doc.querySelector('.add-btn'));
 assert.match(doc.getElementById('shop').textContent,/DEMO PRICE/);assert.match(doc.getElementById('shop').textContent,/₹/);
 doc.querySelector('[data-q="1"]').click();assert.equal(doc.getElementById('buy-qty').textContent,'2');doc.querySelector('.add-btn').click();
 await wait(()=>doc.querySelector('#cart-btn b').textContent==='2');assert.match(doc.querySelector('.toast').textContent,/added to cart/);assert.equal(doc.querySelector('.add-btn').textContent,'ADDED ✓');
 doc.querySelector('#cart-btn').click();assert.ok(doc.querySelector('#cart-drawer').classList.contains('open'));assert.equal(doc.querySelectorAll('.ci').length,1);assert.match(doc.querySelector('#cart-drawer').textContent,/DEMO PRICES/);
 doc.querySelector('[data-act="inc"]').click();await wait(()=>doc.querySelector('#cart-btn b').textContent==='3');
 const exp=w.Shop.cart().totalMinor;assert.equal(doc.getElementById('cart-total').textContent,w.Shop.money(exp));assert.ok(exp>0);
 doc.querySelector('[data-act="dec"]').click();await wait(()=>doc.querySelector('#cart-btn b').textContent==='2');
 doc.querySelector('[data-act="clear"]').click();await wait(()=>doc.querySelector('#cart-btn b').textContent==='0');assert.match(doc.querySelector('#cart-drawer').textContent,/cart is empty/);w.close()});

let token;
test('UI: checkout page shows summary, generates the demo QR, then reflects confirmation without claiming payment',async()=>{
 const g=randomBytes(24).toString('hex');await fetch(base+'/api/cart/items',{method:'POST',headers:{'Content-Type':'application/json','X-Guest-Token':g},body:JSON.stringify({productId:pid,quantity:2})});
 const d=dom(pub('checkout.html'),base+'/checkout.html',{before:w=>w.localStorage.setItem('bd_guest',g)});const doc=d.window.document;
 await wait(()=>!doc.getElementById('gen-box').hidden);assert.match(doc.getElementById('sum').textContent,/Heineken/);assert.match(doc.getElementById('sum').textContent,/Total \(demo\)/);assert.match(doc.body.textContent,/NO PAYMENT IS TAKEN/);
 assert.equal(doc.getElementById('gen').textContent,'GENERATE DEMO QR CODE');doc.getElementById('name').value='Asha';doc.getElementById('gen').click();
 const img=await wait(()=>doc.querySelector('#qr img'));assert.match(img.src,/^data:image\/svg\+xml/);
 token=doc.getElementById('qr').textContent.match(/demo-payment\/([A-Za-z0-9_-]{43})/)[1];
 const st=await fetch(base+`/api/demo-checkout/${token}/status`);assert.equal((await st.json()).status,'pending');
 await fetch(base+`/api/demo-checkout/${token}/complete-demo`,{method:'POST'});
 await wait(()=>/DEMONSTRATION CHECKOUT/.test(doc.getElementById('state').textContent),8000);assert.doesNotMatch(doc.body.textContent,/payment\s+successful/i);d.window.close()});
test('UI: QR landing page renders the thank-you experience from the API (and handles expiry)',async()=>{
 const url=`${base}/demo-payment/${token}`,html=await (await fetch(url)).text();const d=dom(html,url);const doc=d.window.document;
 await wait(()=>/THANK YOU FOR VISITING!/.test(doc.getElementById('m').textContent));
 for(const s of ['THE BEAR’S DEN','Your virtual bar experience was wonderful.','THIS WAS A DEMONSTRATION CHECKOUT.'])assert.ok(doc.getElementById('m').textContent.includes(s),s);
 assert.match(doc.getElementById('m').textContent,/DEMO-[0-9A-F]{8}/);assert.ok(doc.getElementById('bear'));const a=doc.querySelector('a.btn');assert.equal(a.textContent,'RETURN TO THE BAR');assert.equal(a.getAttribute('href'),'/');assert.doesNotMatch(doc.getElementById('m').textContent,/payment\s+successful/i);d.window.close();
 const pool2=(await import('../src/db/pool.js')).q;await pool2(`UPDATE demo_orders SET expires_at=now()-interval '1 minute',status='pending',confirmed_at=NULL WHERE session_token=$1`,[token]);
 const e=dom(html,url);await wait(()=>/expired/i.test(e.window.document.getElementById('m').textContent));assert.doesNotMatch(e.window.document.getElementById('m').textContent,/THANK YOU FOR VISITING/);e.window.close()});
