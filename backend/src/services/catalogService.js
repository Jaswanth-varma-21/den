import {q} from '../db/pool.js';import {HttpError,esc} from '../utils/http.js';import {unit} from '../utils/money.js';
const priced=r=>{const {_pm,_db,_cur,_st,...p}=r;p.price=_pm==null?null:{currency:(_cur||'INR').trim(),priceMinor:_pm,discountBp:_db,displayMinor:unit(_pm,_db),availability:_st,demo:true};p.availability=_pm==null?'unavailable':_st;return p};
const PSEL=`p.id,p.name,p.description,p.history,p.abv::float8 AS abv,p.abv_note AS "abvNote",p.bottle_image_url AS "bottleImageUrl",p.model_url AS "modelUrl",(SELECT a.source_note FROM assets a WHERE a.url=p.bottle_image_url LIMIT 1) AS "imageNote",p.specs,p.color,pp.price_minor AS "_pm",pp.discount_bp AS "_db",pp.currency AS "_cur",pp.status AS "_st",p.brand_id AS "brandId",b.name AS brand,p.category_id AS "categoryId",c.name AS category,c.slug AS "categorySlug",p.country_id AS "countryId",co.name AS country,p.created_at AS "createdAt",p.updated_at AS "updatedAt"`;
const PFROM=`FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id JOIN countries co ON co.id=p.country_id LEFT JOIN product_prices pp ON pp.product_id=p.id`;
const BSEL=`b.id,b.name,b.description,b.logo_url AS "logoUrl",b.founded_year AS "foundedYear",b.country_id AS "countryId",co.name AS country,b.category_id AS "categoryId",c.name AS category,c.slug AS "categorySlug",(SELECT count(*) FROM products p WHERE p.brand_id=b.id)::int AS "productCount"`;
const BFROM=`FROM brands b JOIN countries co ON co.id=b.country_id JOIN categories c ON c.id=b.category_id`;
function filters(f,nameCols,alias){const w=[],v=[];const add=(sql,val)=>{v.push(val);w.push(sql.replaceAll('$#','$'+v.length))};
 if(f.q)add(nameCols.map(c=>`${c} ILIKE $# ESCAPE '\\'`).join(' OR ').replace(/^/,'(')+')','%'+esc(f.q)+'%');
 if(f.country)add('(co.name ILIKE $# OR co.code ILIKE $#)',f.country);
 if(f.category)add('(c.slug=lower($#) OR c.name ILIKE $#)',f.category);
 if(f.brandId)add(`${alias}.brand_id=$#`,f.brandId);
 return {where:w.length?'WHERE '+w.join(' AND '):'',v}}
async function paged(sel,from,f,nameCols,alias,sorts){
 const {where,v}=filters(f,nameCols,alias);const s=sorts[f.sort]||sorts.id,dir=f.dir==='desc'?'DESC':'ASC';
 const total=(await q(`SELECT count(*)::int AS n ${from} ${where}`,v)).rows[0].n;
 const items=(await q(`SELECT ${sel} ${from} ${where} ORDER BY ${s} ${dir} NULLS LAST,${alias}.id LIMIT $${v.length+1} OFFSET $${v.length+2}`,[...v,f.limit,(f.page-1)*f.limit])).rows;
 return {items,page:f.page,limit:f.limit,total,pages:Math.ceil(total/f.limit)}}
const PSORT={id:'p.id',name:'p.name',brand:'b.name',abv:'p.abv',newest:'p.created_at'},BSORT={id:'b.id',name:'b.name',brand:'b.name',abv:'b.id',newest:'b.created_at'};
export const listProducts=f=>paged(PSEL,PFROM,f,['p.name','b.name'],'p',PSORT).then(r=>({...r,items:r.items.map(priced)}));
export const listBrands=f=>paged(BSEL,BFROM,{...f,brandId:undefined},['b.name'],'b',BSORT);
async function patchRow(table,id,body,map,stamp=true){const sets=[],v=[];
 for(const [k,col] of Object.entries(map))if(body[k]!==undefined){v.push(col==='specs'?JSON.stringify(body[k]):body[k]);sets.push(`${col}=$${v.length}`)}
 if(!sets.length)throw new HttpError(400,'No fields to update');v.push(id);
 const r=await q(`UPDATE ${table} SET ${sets.join(',')}${stamp?',updated_at=now()':''} WHERE id=$${v.length} RETURNING id`,v);if(!r.rowCount)throw new HttpError(404,'Not found')}
export async function getProduct(id){
 const r=await q(`SELECT ${PSEL} ${PFROM} WHERE p.id=$1`,[id]);if(!r.rowCount)throw new HttpError(404,'Product not found');const p=priced(r.rows[0]);
 p.variants=(await q(`SELECT id,name,abv::float8 AS abv,size_ml AS "sizeMl" FROM product_variants WHERE product_id=$1 ORDER BY id`,[id])).rows;
 p.related=(await q(`SELECT ${PSEL} ${PFROM} WHERE p.id<>$1 AND (p.category_id=$2 OR p.brand_id=$3) ORDER BY (p.brand_id=$3) DESC,p.id LIMIT 6`,[id,p.categoryId,p.brandId])).rows.map(priced);
 p.assets=(await q(`SELECT id,kind,url,mime,size_bytes AS "sizeBytes",source_url AS "sourceUrl",source_note AS "sourceNote",license,attribution FROM assets WHERE product_id=$1`,[id])).rows;return p}
const PMAP={brandId:'brand_id',categoryId:'category_id',countryId:'country_id',name:'name',description:'description',history:'history',abv:'abv',abvNote:'abv_note',bottleImageUrl:'bottle_image_url',modelUrl:'model_url',specs:'specs',color:'color'};
export async function createProduct(b){
 const r=await q(`INSERT INTO products(brand_id,category_id,country_id,name,description,history,abv,abv_note,bottle_image_url,model_url,specs,color) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
  [b.brandId,b.categoryId,b.countryId,b.name,b.description??null,b.history??null,b.abv??null,b.abvNote??null,b.bottleImageUrl??null,b.modelUrl??null,JSON.stringify(b.specs??{}),b.color??null]);return getProduct(r.rows[0].id)}
export async function updateProduct(id,b){await patchRow('products',id,b,PMAP);return getProduct(id)}
export async function deleteProduct(id){if(!(await q('DELETE FROM products WHERE id=$1',[id])).rowCount)throw new HttpError(404,'Product not found')}
export async function addVariant(pid,b){await getProduct(pid);return (await q(`INSERT INTO product_variants(product_id,name,abv,size_ml) VALUES($1,$2,$3,$4) RETURNING id,name,abv::float8 AS abv,size_ml AS "sizeMl"`,[pid,b.name,b.abv??null,b.sizeMl??null])).rows[0]}
export async function deleteVariant(pid,vid){if(!(await q('DELETE FROM product_variants WHERE id=$1 AND product_id=$2',[vid,pid])).rowCount)throw new HttpError(404,'Variant not found')}
export async function getBrand(id){
 const r=await q(`SELECT ${BSEL} ${BFROM} WHERE b.id=$1`,[id]);if(!r.rowCount)throw new HttpError(404,'Brand not found');const b=r.rows[0];
 b.history=(await q(`SELECT id,year,event FROM brand_history WHERE brand_id=$1 ORDER BY year NULLS LAST,id`,[id])).rows;
 b.products=(await q(`SELECT ${PSEL} ${PFROM} WHERE p.brand_id=$1 ORDER BY p.id`,[id])).rows.map(priced);return b}
const BMAP={name:'name',countryId:'country_id',categoryId:'category_id',description:'description',logoUrl:'logo_url',foundedYear:'founded_year'};
export async function createBrand(b){const r=await q(`INSERT INTO brands(name,country_id,category_id,description,logo_url,founded_year) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[b.name,b.countryId,b.categoryId,b.description??null,b.logoUrl??null,b.foundedYear??null]);return getBrand(r.rows[0].id)}
export async function updateBrand(id,b){await patchRow('brands',id,b,BMAP);return getBrand(id)}
export async function deleteBrand(id){if(!(await q('DELETE FROM brands WHERE id=$1',[id])).rowCount)throw new HttpError(404,'Brand not found')}
export async function addHistory(id,b){await getBrand(id);return (await q(`INSERT INTO brand_history(brand_id,year,event) VALUES($1,$2,$3) RETURNING id,year,event`,[id,b.year??null,b.event])).rows[0]}
const LK={categories:{cols:['id','name','slug'],map:{name:'name',slug:'slug'}},countries:{cols:['id','name','code'],map:{name:'name',code:'code'}}};
export const listLookup=async t=>(await q(`SELECT ${LK[t].cols.join(',')} FROM ${t} ORDER BY name`)).rows;
export async function createLookup(t,b){
 if(t==='countries'){if(!b.code)throw new HttpError(400,'code is required');return (await q(`INSERT INTO countries(name,code) VALUES($1,$2) RETURNING id,name,code`,[b.name,b.code.toUpperCase()])).rows[0]}
 const slug=b.slug||b.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return (await q(`INSERT INTO categories(name,slug) VALUES($1,$2) RETURNING id,name,slug`,[b.name,slug])).rows[0]}
export async function updateLookup(t,id,b){await patchRow(t,id,b,LK[t].map,false);return (await q(`SELECT ${LK[t].cols.join(',')} FROM ${t} WHERE id=$1`,[id])).rows[0]}
export async function deleteLookup(t,id){if(!(await q(`DELETE FROM ${t} WHERE id=$1`,[id])).rowCount)throw new HttpError(404,'Not found')}
export async function searchAll(term,limit=10){const base={q:term,page:1,limit,sort:'name',dir:'asc'};
 const [brands,products]=await Promise.all([listBrands(base),listProducts(base)]);return {brands:brands.items,products:products.items}}
