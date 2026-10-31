import {q} from '../db/pool.js';import {HttpError} from '../utils/http.js';
const PCARD=`p.id,p.name,b.name AS brand,c.name AS category,co.name AS country,p.abv::float8 AS abv,p.color`;
const PJ=`JOIN products p ON p.id=X.product_id JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id JOIN countries co ON co.id=p.country_id`;
export async function favorites(uid){
 const products=(await q(`SELECT ${PCARD} FROM favorite_products X ${PJ} WHERE X.user_id=$1 ORDER BY X.created_at DESC`,[uid])).rows;
 const brands=(await q(`SELECT b.id,b.name FROM favorite_brands f JOIN brands b ON b.id=f.brand_id WHERE f.user_id=$1 ORDER BY f.created_at DESC`,[uid])).rows;return {products,brands}}
export async function setFavorite(kind,uid,id,on){const t=kind==='products'?'favorite_products':'favorite_brands',col=kind==='products'?'product_id':'brand_id';
 if(on)await q(`INSERT INTO ${t}(user_id,${col}) VALUES($1,$2) ON CONFLICT DO NOTHING`,[uid,id]);else await q(`DELETE FROM ${t} WHERE user_id=$1 AND ${col}=$2`,[uid,id])}
export const markViewed=(uid,pid)=>q(`INSERT INTO recently_viewed(user_id,product_id) VALUES($1,$2) ON CONFLICT(user_id,product_id) DO UPDATE SET viewed_at=now()`,[uid,pid]);
export const recent=async uid=>({items:(await q(`SELECT ${PCARD},X.viewed_at AS "viewedAt" FROM recently_viewed X ${PJ} WHERE X.user_id=$1 ORDER BY X.viewed_at DESC LIMIT 20`,[uid])).rows});
export const history=async uid=>({items:(await q(`SELECT type,entity_type AS "entityType",entity_id AS "entityId",meta,created_at AS "createdAt" FROM user_activity WHERE user_id=$1 ORDER BY id DESC LIMIT 50`,[uid])).rows});
export const collections=async uid=>(await q(`SELECT c.id,c.name,COALESCE(json_agg(json_build_object('id',p.id,'name',p.name)) FILTER (WHERE p.id IS NOT NULL),'[]') AS products FROM collections c LEFT JOIN collection_items ci ON ci.collection_id=c.id LEFT JOIN products p ON p.id=ci.product_id WHERE c.user_id=$1 GROUP BY c.id ORDER BY c.id`,[uid])).rows;
export const createCollection=async(uid,name)=>(await q(`INSERT INTO collections(user_id,name) VALUES($1,$2) RETURNING id,name`,[uid,name])).rows[0];
async function own(uid,cid){if(!(await q('SELECT 1 FROM collections WHERE id=$1 AND user_id=$2',[cid,uid])).rowCount)throw new HttpError(404,'Collection not found')}
export async function collectionItem(uid,cid,pid,on){await own(uid,cid);
 if(on)await q(`INSERT INTO collection_items(collection_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[cid,pid]);else await q(`DELETE FROM collection_items WHERE collection_id=$1 AND product_id=$2`,[cid,pid])}
export async function deleteCollection(uid,cid){await own(uid,cid);await q('DELETE FROM collections WHERE id=$1',[cid])}
