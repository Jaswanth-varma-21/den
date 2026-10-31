import {q} from '../db/pool.js';
export const record=({type,entityType=null,entityId=null,sessionId=null,userId=null,meta=null})=>
 q(`INSERT INTO user_activity(user_id,session_id,type,entity_type,entity_id,meta) VALUES($1,$2,$3,$4,$5,$6)`,[userId,sessionId,type,entityType,entityId,meta?JSON.stringify(meta):null]).catch(e=>console.error('analytics',e.message));
export async function summary(){
 const one=async s=>(await q(s)).rows,v=await one(`SELECT count(DISTINCT session_id)::int AS n FROM user_activity WHERE type='visit' AND session_id IS NOT NULL`);
 return {totalVisitors:v[0].n,
  registeredUsers:(await one(`SELECT count(*)::int AS n FROM users`))[0].n,
  mostExploredBrands:await one(`SELECT b.id,b.name,count(*)::int AS views FROM user_activity a JOIN products p ON p.id=a.entity_id JOIN brands b ON b.id=p.brand_id WHERE a.type='view' AND a.entity_type='product' GROUP BY b.id ORDER BY views DESC,b.name LIMIT 10`),
  mostViewedProducts:await one(`SELECT p.id,p.name,count(*)::int AS views FROM user_activity a JOIN products p ON p.id=a.entity_id WHERE a.type='view' AND a.entity_type='product' GROUP BY p.id ORDER BY views DESC,p.name LIMIT 10`),
  popularCategories:await one(`SELECT c.name,count(*)::int AS views FROM user_activity a JOIN products p ON p.id=a.entity_id JOIN categories c ON c.id=p.category_id WHERE a.type='view' AND a.entity_type='product' GROUP BY c.id ORDER BY views DESC,c.name LIMIT 10`),
  topSearches:await one(`SELECT lower(meta->>'q') AS term,count(*)::int AS n FROM user_activity WHERE type='search' GROUP BY 1 ORDER BY n DESC LIMIT 10`),
  interactions:await one(`SELECT type,count(*)::int AS n FROM user_activity GROUP BY type ORDER BY n DESC`)}}
