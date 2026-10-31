import * as auth from '../services/authService.js';import * as cat from '../services/catalogService.js';import * as usr from '../services/userService.js';import * as an from '../services/analyticsService.js';
import {q} from '../db/pool.js';import {HttpError,wrap} from '../utils/http.js';
const id=req=>Number(req.params.id);
export const A={register:wrap(async(req,res)=>res.status(201).json(await auth.register(req.valid.body))),login:wrap(async(req,res)=>res.json(await auth.login(req.valid.body))),
 logout:wrap(async(req,res)=>{await auth.logout(req.user);res.status(204).end()}),me:(req,res)=>res.json({user:{id:req.user.id,email:req.user.email,username:req.user.username,role:req.user.role}})};
const searched=(req,f)=>{if(f.q)an.record({type:'search',userId:req.user?.id,meta:{q:f.q.slice(0,100)}})};
export const C={
 brands:wrap(async(req,res)=>{searched(req,req.valid.query);res.json(await cat.listBrands(req.valid.query))}),brand:wrap(async(req,res)=>res.json(await cat.getBrand(id(req)))),
 brandNew:wrap(async(req,res)=>res.status(201).json(await cat.createBrand(req.valid.body))),brandEdit:wrap(async(req,res)=>res.json(await cat.updateBrand(id(req),req.valid.body))),
 brandDel:wrap(async(req,res)=>{await cat.deleteBrand(id(req));res.status(204).end()}),brandHist:wrap(async(req,res)=>res.status(201).json(await cat.addHistory(id(req),req.valid.body))),
 products:wrap(async(req,res)=>{searched(req,req.valid.query);res.json(await cat.listProducts(req.valid.query))}),
 product:wrap(async(req,res)=>{const p=await cat.getProduct(id(req));if(req.user)await usr.markViewed(req.user.id,p.id);res.json(p)}),
 productNew:wrap(async(req,res)=>res.status(201).json(await cat.createProduct(req.valid.body))),productEdit:wrap(async(req,res)=>res.json(await cat.updateProduct(id(req),req.valid.body))),
 productDel:wrap(async(req,res)=>{await cat.deleteProduct(id(req));res.status(204).end()}),variantNew:wrap(async(req,res)=>res.status(201).json(await cat.addVariant(id(req),req.valid.body))),
 variantDel:wrap(async(req,res)=>{await cat.deleteVariant(id(req),Number(req.params.vid));res.status(204).end()}),
 search:wrap(async(req,res)=>{const t=(req.query.q||'').toString().trim().slice(0,100);if(!t)throw new HttpError(400,'q is required');an.record({type:'search',userId:req.user?.id,meta:{q:t}});res.json(await cat.searchAll(t))}),
 lookupList:t=>wrap(async(req,res)=>res.json({items:await cat.listLookup(t)})),lookupNew:t=>wrap(async(req,res)=>res.status(201).json(await cat.createLookup(t,req.valid.body))),
 lookupEdit:t=>wrap(async(req,res)=>res.json(await cat.updateLookup(t,id(req),req.valid.body))),lookupDel:t=>wrap(async(req,res)=>{await cat.deleteLookup(t,id(req));res.status(204).end()})};
export const U={favorites:wrap(async(req,res)=>res.json(await usr.favorites(req.user.id))),
 fav:(kind,on)=>wrap(async(req,res)=>{await usr.setFavorite(kind,req.user.id,id(req),on);if(on)an.record({type:'favorite',entityType:kind==='products'?'product':'brand',entityId:id(req),userId:req.user.id});res.status(204).end()}),
 recent:wrap(async(req,res)=>res.json(await usr.recent(req.user.id))),history:wrap(async(req,res)=>res.json(await usr.history(req.user.id))),
 collections:wrap(async(req,res)=>res.json({items:await usr.collections(req.user.id)})),collNew:wrap(async(req,res)=>res.status(201).json(await usr.createCollection(req.user.id,req.valid.body.name))),
 collItem:on=>wrap(async(req,res)=>{await usr.collectionItem(req.user.id,id(req),Number(req.params.pid),on);res.status(204).end()}),collDel:wrap(async(req,res)=>{await usr.deleteCollection(req.user.id,id(req));res.status(204).end()})};
export const M={track:wrap(async(req,res)=>{const b=req.valid.body;await an.record({...b,userId:req.user?.id});res.status(202).json({ok:true})}),
 users:wrap(async(req,res)=>{const l=Math.min(+req.query.limit||50,100),o=(Math.max(+req.query.page||1,1)-1)*l;res.json({items:(await q(`SELECT u.id,u.email,u.username,r.name AS role,u.created_at AS "createdAt" FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,[l,o])).rows})}),
 setRole:wrap(async(req,res)=>{if(req.params.uid===req.user.id)throw new HttpError(400,'You cannot change your own role');const r=await q(`UPDATE users SET role_id=(SELECT id FROM roles WHERE name=$1) WHERE id=$2 RETURNING id`,[req.valid.body.role,req.params.uid]);if(!r.rowCount)throw new HttpError(404,'User not found');res.json({ok:true})}),
 analytics:wrap(async(req,res)=>res.json(await an.summary()))};
