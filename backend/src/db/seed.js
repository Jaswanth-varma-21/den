import fs from 'node:fs';import bcrypt from 'bcryptjs';import {q} from './pool.js';import {cfg} from '../config/index.js';
const CODES={Scotland:'GB-SCT',England:'GB-ENG','United States':'US',Sweden:'SE',France:'FR',Cuba:'CU',Ireland:'IE',Mexico:'MX',Netherlands:'NL',Japan:'JP'};
export async function seed(){
 const data=JSON.parse(fs.readFileSync(new URL('../../data/seed.json',import.meta.url),'utf8'));
 for(const p of data){
  const slug=p.category.toLowerCase();
  const cat=(await q(`INSERT INTO categories(name,slug) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,[p.category,slug])).rows[0].id;
  const co=(await q(`INSERT INTO countries(name,code) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,[p.country,CODES[p.country]||p.country.slice(0,3).toUpperCase()])).rows[0].id;
  const b=(await q(`INSERT INTO brands(name,country_id,category_id) VALUES($1,$2,$3) ON CONFLICT(lower(name)) DO UPDATE SET country_id=EXCLUDED.country_id RETURNING id`,[p.brand,co,cat])).rows[0].id;
  await q(`INSERT INTO products(brand_id,category_id,country_id,name,description,abv,abv_note,specs,color) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
   ON CONFLICT(brand_id,name) DO UPDATE SET description=EXCLUDED.description,abv=EXCLUDED.abv,abv_note=EXCLUDED.abv_note,specs=EXCLUDED.specs,color=EXCLUDED.color,updated_at=now()`,[b,cat,co,p.name,p.description,p.abv,p.abvNote,JSON.stringify(p.specs||{}),p.color]);
  const y=(p.description.match(/\b(1[0-9]{3})\b/)||[])[1];
  if(y&&!(await q(`SELECT 1 FROM brand_history WHERE brand_id=$1 AND year=$2`,[b,+y])).rowCount)await q(`INSERT INTO brand_history(brand_id,year,event) VALUES($1,$2,$3)`,[b,+y,p.description])}
 if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD){
  const hash=await bcrypt.hash(process.env.ADMIN_PASSWORD,cfg.bcryptRounds);
  await q(`INSERT INTO users(email,username,password_hash,role_id) VALUES($1,'admin',$2,(SELECT id FROM roles WHERE name='admin')) ON CONFLICT(lower(email)) DO UPDATE SET password_hash=EXCLUDED.password_hash,role_id=EXCLUDED.role_id`,[process.env.ADMIN_EMAIL.toLowerCase(),hash])}
 return data.length}
