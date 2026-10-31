import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {q} from './pool.js';import {cfg} from '../config/index.js';
const base=new URL('../../data/',import.meta.url);
export async function importPhotos(){
 const list=JSON.parse(fs.readFileSync(new URL('photos.json',base),'utf8'));fs.mkdirSync(cfg.uploadDir,{recursive:true});let n=0;
 for(const e of list){
  const find=()=>q(`SELECT p.id FROM products p JOIN brands b ON b.id=p.brand_id WHERE lower(b.name)=lower($1) AND lower(p.name)=lower($2)`,[e.brand,e.product]).then(r=>r.rows[0]);
  let p=await find();
  if(!p&&e.create){const c=e.create;
   const cat=(await q(`SELECT id FROM categories WHERE name=$1`,[c.category])).rows[0].id;
   const co=(await q(`INSERT INTO countries(name,code) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,[c.country,c.code])).rows[0].id;
   const b=(await q(`INSERT INTO brands(name,country_id,category_id) VALUES($1,$2,$3) ON CONFLICT(lower(name)) DO UPDATE SET name=brands.name RETURNING id`,[e.brand,co,cat])).rows[0].id;
   await q(`INSERT INTO products(brand_id,category_id,country_id,name,description,abv,specs) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(brand_id,name) DO NOTHING`,[b,cat,co,e.product,c.description,c.abv,JSON.stringify(c.specs||{})]);
   p=await find()}
  if(!p){console.warn('no product for photo',e.brand,e.product);continue}
  if((await q('SELECT 1 FROM assets WHERE product_id=$1 AND original_name=$2',[p.id,e.file])).rowCount)continue;
  const stored=randomUUID()+'.jpg',src=new URL('photos/'+e.file,base);fs.copyFileSync(src,path.join(cfg.uploadDir,stored));
  const url='/api/assets/file/'+stored;
  await q(`INSERT INTO assets(kind,product_id,original_name,stored_name,mime,size_bytes,url,source_url,source_note,license,attribution) VALUES('thumbnail',$1,$2,$3,'image/jpeg',$4,$5,$6,$7,'unverified (supplied by project owner)',$8)`,[p.id,e.file,stored,fs.statSync(src).size,url,e.sourceUrl||null,e.note,e.attribution||null]);
  await q('UPDATE products SET bottle_image_url=$1,updated_at=now() WHERE id=$2',[url,p.id]);n++}
 return n}
