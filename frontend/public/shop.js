(()=>{'use strict';
let guest='';try{guest=localStorage.getItem('bd_guest')||''}catch(e){}
if(!/^[a-f0-9]{48}$/.test(guest)){guest=[...crypto.getRandomValues(new Uint8Array(24))].map(b=>b.toString(16).padStart(2,'0')).join('');try{localStorage.setItem('bd_guest',guest)}catch(e){}}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const money=(m,c='INR')=>new Intl.NumberFormat('en-IN',{style:'currency',currency:c}).format(m/100);
async function api(p,o={}){const h={'Content-Type':'application/json','X-Guest-Token':guest};let t='';try{t=sessionStorage.getItem('tk')||''}catch(e){}if(t)h.Authorization='Bearer '+t;
 const r=await fetch('/api'+p,{...o,headers:{...h,...(o.headers||{})}});let j=null;if(r.status!==204){try{j=await r.json()}catch(e){}}
 if(!r.ok)throw new Error((j&&j.error)||('Request failed ('+r.status+')'));return j}
let cart={items:[],subtotalMinor:0,taxMinor:0,totalMinor:0,taxBp:0};
const S={api,money,esc,cart:()=>cart,guest:()=>guest};window.Shop=S;
const st=document.createElement('style');st.textContent=`
.demo-tag{display:inline-block;border:1px solid #d9a441;color:#d9a441;font:11px/1 Georgia,serif;letter-spacing:.14em;padding:4px 8px;margin:4px 0}
.shop-box{border-top:1px solid #d9a44155;margin:12px 0;padding-top:10px}.shop-box .price{font-size:22px;color:#f3d28a}.shop-box s{opacity:.55;font-size:14px;margin-left:8px}
.shop-box .pill{font-size:12px;opacity:.8}.qty{display:flex;align-items:center;gap:10px;margin:8px 0}.qty span{min-width:24px;text-align:center}
#cart-btn{position:relative}#cart-btn b{display:inline-block;min-width:16px;background:#d9a441;color:#120a05;border-radius:9px;padding:0 4px;margin-left:4px}
#cart-btn.bump{animation:bump .5s}@keyframes bump{40%{transform:scale(1.25)}}
#cart-drawer{position:fixed;top:0;right:0;bottom:0;width:min(400px,100%);box-sizing:border-box;padding:16px;padding-top:calc(16px + env(safe-area-inset-top,0px));background:rgba(18,10,5,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-left:1px solid #d9a44166;transform:translateX(105%);transition:transform .45s cubic-bezier(.2,.8,.2,1);z-index:12;overflow:auto;color:#f0e6d2;font-family:Georgia,serif}
#cart-drawer.open{transform:none}.dh{display:flex;justify-content:space-between;align-items:center}.dh h3{margin:0;color:#d9a441;font-weight:400;letter-spacing:.12em}
.ci{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #d9a44133}.ci img,.ci .sw{width:44px;height:60px;object-fit:cover;border-radius:4px;flex:none}
.ct{flex:1;display:flex;flex-direction:column;font-size:13px}.ct em{color:#f3d28a;font-style:normal}.cq{display:flex;align-items:center;gap:4px}
.cs{margin-top:14px;display:grid;gap:6px}.cs div{display:flex;justify-content:space-between}.cs .tt{font-size:18px;color:#f3d28a}
.co{display:block;text-align:center;border:1px solid #d9a441;color:#d9a441;padding:12px;margin-top:8px;text-decoration:none;letter-spacing:.12em}.co:hover{background:#d9a441;color:#120a05}
#cart-drawer button,.shop-box button{background:none;border:1px solid #d9a44188;color:#d9a441;padding:6px 10px;font:inherit;cursor:pointer}
.toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:#120a05ee;border:1px solid #d9a441;color:#f3d28a;padding:10px 18px;z-index:30;animation:tin .3s}@keyframes tin{from{opacity:0;transform:translate(-50%,10px)}}
.fly{position:fixed;width:14px;height:14px;border-radius:50%;background:#d9a441;z-index:31;transition:all .7s cubic-bezier(.5,0,.8,.4);pointer-events:none}`;document.head.append(st);
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),2200)}
const bar=document.getElementById('bar');let btn,drawer;
const thumb=i=>i.imageUrl?`<img src="${esc(i.imageUrl)}" alt="">`:`<span class="sw" style="background:#${(i.color||0xb5651d).toString(16).padStart(6,'0')}"></span>`;
function draw(){const n=cart.items.reduce((s,i)=>s+i.quantity,0);
 if(btn)btn.querySelector('b').textContent=n;if(!drawer)return;
 const rows=cart.items.map(i=>`<div class="ci" data-id="${i.id}">${thumb(i)}<div class="ct"><b>${esc(i.brand)}</b><span>${esc(i.name)}</span><em>${i.availability==='unavailable'?'Unavailable':money(i.unitMinor)+' × '+i.quantity}</em></div><div class="cq"><button data-act="dec" aria-label="Decrease">−</button><span>${i.quantity}</span><button data-act="inc" aria-label="Increase">+</button><button data-act="rm" aria-label="Remove">✕</button></div></div>`).join('')||'<p>Your cart is empty.</p>';
 drawer.innerHTML=`<div class="dh"><h3>YOUR CART</h3><button data-act="close" aria-label="Close">✕</button></div><div class="demo-tag">DEMO PRICES · not real retail prices</div><div>${rows}</div><div class="cs"><div>Subtotal <b>${money(cart.subtotalMinor)}</b></div><div>Demo tax (${(cart.taxBp/100).toFixed(0)}%) <b>${money(cart.taxMinor)}</b></div><div class="tt">Total <b id="cart-total">${money(cart.totalMinor)}</b></div><a class="co" href="/checkout.html">CHECKOUT (DEMO)</a><button data-act="clear">Clear cart</button></div>`}
async function refresh(){try{cart=await api('/cart')}catch(e){}draw();return cart}
S.refresh=refresh;
if(bar){btn=document.createElement('button');btn.id='cart-btn';btn.setAttribute('aria-label','Open cart');btn.innerHTML='🛒 CART <b>0</b>';
 drawer=document.createElement('div');drawer.id='cart-drawer';document.body.append(drawer);
 btn.onclick=()=>{drawer.classList.toggle('open')};setTimeout(()=>bar.append(btn),0);
 drawer.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const act=b.dataset.act,id=b.closest('.ci')?.dataset.id,it=cart.items.find(x=>x.id==id);
  try{if(act==='close')return drawer.classList.remove('open');
   if(act==='clear')await api('/cart',{method:'DELETE'});
   else if(act==='rm'||(act==='dec'&&it&&it.quantity<=1))await api('/cart/items/'+id,{method:'DELETE'});
   else if(it)await api('/cart/items/'+id,{method:'PUT',body:JSON.stringify({quantity:Math.min(20,it.quantity+(act==='inc'?1:-1))})})}catch(x){toast(x.message)}
  await refresh()})}
S.renderBuy=async(id,el)=>{if(!el)return;el.textContent='Checking demo price…';
 let p;try{p=await api('/products/'+id)}catch(e){el.textContent='Price unavailable.';return}
 if(!p.price||p.availability==='unavailable'){el.innerHTML='<div class="shop-box"><span class="pill">Not available in the demo shop.</span></div>';return}
 const d=p.price,disc=d.discountBp>0;let q=1;
 el.innerHTML=`<div class="shop-box"><div class="demo-tag">DEMO PRICE</div><div class="price">${money(d.displayMinor,d.currency)}${disc?`<s>${money(d.priceMinor,d.currency)}</s>`:''}</div><div class="pill">${p.availability==='limited'?'Limited availability':'Available'} · demonstration only</div><div class="qty"><button data-q="-1" aria-label="Fewer">−</button><span id="buy-qty">1</span><button data-q="1" aria-label="More">+</button></div><button class="add-btn">ADD TO CART</button></div>`;
 const qs=el.querySelector('#buy-qty'),add=el.querySelector('.add-btn');
 el.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{q=Math.max(1,Math.min(20,q+Number(b.dataset.q)));qs.textContent=q});
 add.onclick=async()=>{add.disabled=true;try{cart=await api('/cart/items',{method:'POST',body:JSON.stringify({productId:Number(id),quantity:q})});draw();
   const a=add.getBoundingClientRect(),c=btn?btn.getBoundingClientRect():null;if(c){const f=document.createElement('div');f.className='fly';f.style.left=a.left+a.width/2+'px';f.style.top=a.top+'px';document.body.append(f);requestAnimationFrame(()=>{f.style.left=c.left+c.width/2+'px';f.style.top=c.top+'px';f.style.opacity='.2'});setTimeout(()=>f.remove(),800)}
   if(btn){btn.classList.remove('bump');void btn.offsetWidth;btn.classList.add('bump')}
   add.textContent='ADDED ✓';toast(q+' × '+p.brand+' added to cart');setTimeout(()=>{add.textContent='ADD TO CART'},1500)}catch(x){toast(x.message)}add.disabled=false}};
refresh()})();
