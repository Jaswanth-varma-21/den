import {q} from '../db/pool.js';import {HttpError} from '../utils/http.js';
export async function setPrice(id,b){
 const r=await q(`INSERT INTO product_prices(product_id,price_minor,currency,discount_bp,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(product_id) DO UPDATE SET price_minor=EXCLUDED.price_minor,currency=EXCLUDED.currency,discount_bp=EXCLUDED.discount_bp,status=EXCLUDED.status,updated_at=now() RETURNING product_id AS "productId",price_minor AS "priceMinor",currency,discount_bp AS "discountBp",status`,[id,b.priceMinor,b.currency,b.discountBp,b.status]);return r.rows[0]}
export async function orders(page=1,limit=50){const o=(Math.max(page,1)-1)*limit;
 return {items:(await q(`SELECT o.reference,o.customer_name AS "customerName",o.total_minor AS "totalMinor",o.created_at AS "createdAt",o.expires_at AS "expiresAt",o.scanned_at AS "scannedAt",o.confirmed_at AS "confirmedAt",
  CASE WHEN o.status='confirmed' THEN 'confirmed' WHEN o.expires_at<=now() THEN 'expired' WHEN o.scanned_at IS NOT NULL THEN 'scanned' ELSE 'pending' END AS status,
  (SELECT COALESCE(sum(quantity),0)::int FROM demo_order_items i WHERE i.order_id=o.id) AS "itemCount" FROM demo_orders o ORDER BY o.created_at DESC LIMIT $1 OFFSET $2`,[limit,o])).rows}}
export async function cartActivity(){
 const one=async s=>(await q(s)).rows;
 return {activeCarts:(await one(`SELECT count(DISTINCT cart_id)::int n FROM cart_items`))[0].n,itemsInCarts:(await one(`SELECT COALESCE(sum(quantity),0)::int n FROM cart_items`))[0].n,
  recent:await one(`SELECT a.type,a.created_at AS "at",p.name AS product,a.meta FROM user_activity a LEFT JOIN products p ON a.entity_type='product' AND p.id=a.entity_id WHERE a.type IN('cart_add','cart_remove','checkout','demo_confirm') ORDER BY a.id DESC LIMIT 30`)}}
export const popularity=async()=>({items:(await q(`SELECT p.id AS "productId",p.name,b.name AS brand,COALESCE(v.n,0)::int AS views,COALESCE(c.n,0)::int AS "cartAdds",COALESCE(o.n,0)::int AS "unitsOrdered"
 FROM products p JOIN brands b ON b.id=p.brand_id
 LEFT JOIN (SELECT entity_id,count(*) n FROM user_activity WHERE type='view' AND entity_type='product' GROUP BY 1) v ON v.entity_id=p.id
 LEFT JOIN (SELECT entity_id,count(*) n FROM user_activity WHERE type='cart_add' GROUP BY 1) c ON c.entity_id=p.id
 LEFT JOIN (SELECT product_id,sum(quantity)::int n FROM demo_order_items GROUP BY 1) o ON o.product_id=p.id
 ORDER BY COALESCE(c.n,0)+COALESCE(o.n,0)+COALESCE(v.n,0) DESC,p.name LIMIT 20`)).rows});
