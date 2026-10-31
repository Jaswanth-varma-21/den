import {createHash} from 'node:crypto';import {q} from '../db/pool.js';import {HttpError} from '../utils/http.js';import {unit,totals} from '../utils/money.js';import {cfg} from '../config/index.js';import {record} from './analyticsService.js';
const GT=/^[A-Za-z0-9_-]{32,64}$/;
const sess=req=>req.user?null:createHash('sha256').update(String(req.headers['x-guest-token']||'')).digest('hex').slice(0,16);
export async function resolve(req,create){
 const g=req.headers['x-guest-token'],gOk=typeof g==='string'&&GT.test(g);
 if(req.user){
  let c=(await q('SELECT * FROM carts WHERE user_id=$1',[req.user.id])).rows[0];
  if(!c&&(create||gOk))c=(await q(`INSERT INTO carts(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET updated_at=now() RETURNING *`,[req.user.id])).rows[0];
  if(c&&gOk){const gc=(await q('SELECT id FROM carts WHERE guest_token=$1',[g])).rows[0];
   if(gc){await q(`INSERT INTO cart_items(cart_id,product_id,quantity) SELECT $1,product_id,quantity FROM cart_items WHERE cart_id=$2 ON CONFLICT(cart_id,product_id) DO UPDATE SET quantity=LEAST(20,cart_items.quantity+EXCLUDED.quantity)`,[c.id,gc.id]);await q('DELETE FROM carts WHERE id=$1',[gc.id])}}
  return c||null}
 if(!gOk){if(create)throw new HttpError(400,'A valid X-Guest-Token header (32-64 URL-safe characters) is required for guest carts');return null}
 let c=(await q('SELECT * FROM carts WHERE guest_token=$1',[g])).rows[0];
 if(!c&&create)c=(await q(`INSERT INTO carts(guest_token) VALUES($1) ON CONFLICT(guest_token) DO UPDATE SET updated_at=now() RETURNING *`,[g])).rows[0];
 return c||null}
export async function view(cart){
 const rows=cart?(await q(`SELECT ci.id,ci.quantity,p.id AS "productId",b.name AS brand,p.name,p.bottle_image_url AS "imageUrl",p.color,pp.price_minor,pp.discount_bp,pp.currency,pp.status FROM cart_items ci JOIN products p ON p.id=ci.product_id JOIN brands b ON b.id=p.brand_id LEFT JOIN product_prices pp ON pp.product_id=p.id WHERE ci.cart_id=$1 ORDER BY ci.id`,[cart.id])).rows:[];
 const items=rows.map(r=>({id:r.id,productId:r.productId,brand:r.brand,name:r.name,imageUrl:r.imageUrl,color:r.color,quantity:r.quantity,priceMinor:r.price_minor,discountBp:r.discount_bp,availability:r.price_minor==null?'unavailable':r.status,unitMinor:r.price_minor==null?0:unit(r.price_minor,r.discount_bp)}));
 const buy=items.filter(i=>i.availability!=='unavailable').map(i=>({...i,lineMinor:i.unitMinor*i.quantity}));
 return {items:items.map(i=>({...i,lineMinor:i.availability==='unavailable'?0:i.unitMinor*i.quantity})),...totals(buy,cfg.demo.taxBp),currency:'INR',demo:true,notice:'DEMO PRICES: not real retail prices. No payment is taken.'}}
export async function addItem(req,{productId,quantity}){
 const pr=(await q(`SELECT p.id,pp.status,pp.price_minor FROM products p LEFT JOIN product_prices pp ON pp.product_id=p.id WHERE p.id=$1`,[productId])).rows[0];
 if(!pr)throw new HttpError(404,'Product not found');
 if(pr.price_minor==null||pr.status==='unavailable')throw new HttpError(409,'This product is not available in the demo shop');
 const c=await resolve(req,true);
 await q(`INSERT INTO cart_items(cart_id,product_id,quantity) VALUES($1,$2,$3) ON CONFLICT(cart_id,product_id) DO UPDATE SET quantity=LEAST(20,cart_items.quantity+EXCLUDED.quantity)`,[c.id,productId,quantity]);
 await q('UPDATE carts SET updated_at=now() WHERE id=$1',[c.id]);
 record({type:'cart_add',entityType:'product',entityId:productId,userId:req.user?.id,sessionId:sess(req),meta:{quantity}});
 return view(c)}
export async function setQty(req,itemId,quantity){const c=await resolve(req,false);
 if(!c||!(await q('UPDATE cart_items SET quantity=$1 WHERE id=$2 AND cart_id=$3',[quantity,itemId,c.id])).rowCount)throw new HttpError(404,'Cart item not found');return view(c)}
export async function removeItem(req,itemId){const c=await resolve(req,false);
 const r=c?await q('DELETE FROM cart_items WHERE id=$1 AND cart_id=$2 RETURNING product_id',[itemId,c.id]):{rowCount:0};
 if(!r.rowCount)throw new HttpError(404,'Cart item not found');
 record({type:'cart_remove',entityType:'product',entityId:r.rows[0].product_id,userId:req.user?.id,sessionId:sess(req)});return view(c)}
export async function clear(req){const c=await resolve(req,false);if(c)await q('DELETE FROM cart_items WHERE cart_id=$1',[c.id]);return view(c)}
