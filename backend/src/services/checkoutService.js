import {randomBytes} from 'node:crypto';import QRCode from 'qrcode';import {q} from '../db/pool.js';import {HttpError} from '../utils/http.js';import {cfg} from '../config/index.js';
import {resolve,view} from './cartService.js';import {record} from './analyticsService.js';
const TOK=/^[A-Za-z0-9_-]{43}$/,NOTICE='THIS WAS A DEMONSTRATION CHECKOUT. No payment was requested or taken.';
export const confirmUrl=t=>`${cfg.demo.publicUrl.replace(/\/$/,'')}/demo-payment/${t}`;
const derive=o=>o.status==='confirmed'?'confirmed':(new Date(o.expires_at)<=new Date()?'expired':(o.scanned_at?'scanned':'pending'));
async function load(token){if(!TOK.test(String(token)))throw new HttpError(404,'Demo session not found');
 const o=(await q('SELECT * FROM demo_orders WHERE session_token=$1',[token])).rows[0];if(!o)throw new HttpError(404,'Demo session not found');return o}
const gone=()=>new HttpError(410,'This demonstration session has expired');
async function summary(o){return {reference:o.reference,status:derive(o),customerName:o.customer_name,currency:o.currency.trim(),
 items:(await q(`SELECT brand,product_name AS name,unit_minor AS "unitMinor",discount_bp AS "discountBp",quantity,line_minor AS "lineMinor" FROM demo_order_items WHERE order_id=$1 ORDER BY id`,[o.id])).rows,
 subtotalMinor:o.subtotal_minor,taxMinor:o.tax_minor,totalMinor:o.total_minor,taxBp:o.tax_bp,createdAt:o.created_at,expiresAt:o.expires_at,confirmedAt:o.confirmed_at,demo:true,notice:NOTICE}}
export async function create(req,{customerName}){
 const c=await resolve(req,false),v=await view(c);
 if(!v.items.length)throw new HttpError(400,'Cart is empty');
 if(v.items.some(i=>i.availability==='unavailable'))throw new HttpError(409,'Remove unavailable items before checkout');
 const token=randomBytes(32).toString('base64url'),ref='DEMO-'+randomBytes(4).toString('hex').toUpperCase();
 const o=(await q(`INSERT INTO demo_orders(reference,session_token,user_id,cart_id,customer_name,currency,subtotal_minor,tax_minor,total_minor,tax_bp,expires_at) VALUES($1,$2,$3,$4,$5,'INR',$6,$7,$8,$9,now()+($10||' minutes')::interval) RETURNING *`,
  [ref,token,req.user?.id??null,c.id,customerName||null,v.subtotalMinor,v.taxMinor,v.totalMinor,v.taxBp,String(cfg.demo.ttlMin)])).rows[0];
 for(const i of v.items)await q(`INSERT INTO demo_order_items(order_id,product_id,brand,product_name,unit_minor,discount_bp,quantity,line_minor) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[o.id,i.productId,i.brand,i.name,i.unitMinor,i.discountBp,i.quantity,i.lineMinor]);
 record({type:'checkout',userId:req.user?.id,meta:{reference:ref,totalMinor:v.totalMinor}});
 const url=confirmUrl(token);
 return {sessionId:token,confirmUrl:url,qrSvg:await QRCode.toString(url,{type:'svg',margin:1}),...(await summary(o))}}
export async function get(token){const o=await load(token);if(derive(o)==='expired')throw gone();
 await q('UPDATE demo_orders SET scanned_at=now() WHERE id=$1 AND scanned_at IS NULL AND status=$2',[o.id,'pending']);return summary(await load(token))}
export async function status(token){const o=await load(token);return {status:derive(o),confirmedAt:o.confirmed_at,expiresAt:o.expires_at}}
export async function complete(token){const o=await load(token);const st=derive(o);if(st==='expired')throw gone();
 if(st!=='confirmed'){await q(`UPDATE demo_orders SET status='confirmed',confirmed_at=now(),scanned_at=COALESCE(scanned_at,now()) WHERE id=$1 AND status='pending'`,[o.id]);
  if(o.cart_id)await q('DELETE FROM cart_items WHERE cart_id=$1',[o.cart_id]);record({type:'demo_confirm',userId:o.user_id,meta:{reference:o.reference}})}
 return summary(await load(token))}
export async function qrPng(token){const o=await load(token);if(derive(o)==='expired')throw gone();return QRCode.toBuffer(confirmUrl(token),{margin:2,scale:6})}
