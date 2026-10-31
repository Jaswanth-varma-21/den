import jwt from 'jsonwebtoken';import {ZodError} from 'zod';import {cfg} from '../config/index.js';import {q} from '../db/pool.js';import {HttpError} from '../utils/http.js';
async function load(req,required){const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):null;
 if(!t){if(required)throw new HttpError(401,'Authentication required');return}
 let p;try{p=jwt.verify(t,cfg.jwtSecret,{algorithms:['HS256']})}catch{throw new HttpError(401,'Invalid or expired token')}
 const r=await q(`SELECT u.id,u.email,u.username,r.name AS role,(SELECT 1 FROM token_denylist d WHERE d.jti=$2) AS revoked FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1`,[p.sub,p.jti]);
 if(!r.rowCount||r.rows[0].revoked)throw new HttpError(401,'Invalid or revoked token');
 req.user={...r.rows[0],jti:p.jti,exp:p.exp}}
export const authenticate=(req,res,next)=>load(req,true).then(()=>next(),next);
export const optionalAuth=(req,res,next)=>load(req,false).then(()=>next(),next);
export const authorize=(...roles)=>(req,res,next)=>roles.includes(req.user?.role)?next():next(new HttpError(403,'Forbidden'));
export const validate=(schema,part='body')=>(req,res,next)=>{const r=schema.safeParse(req[part]);if(!r.success)return next(r.error);req.valid={...req.valid,[part]:r.data};next()};
export const notFound=(req,res,next)=>next(new HttpError(404,'Not found'));
export function errorHandler(err,req,res,next){
 if(err instanceof ZodError)return res.status(400).json({error:'Validation failed',details:err.issues.map(i=>({path:i.path.join('.'),message:i.message}))});
 if(err instanceof HttpError)return res.status(err.status).json({error:err.message});
 if(err.code==='23505')return res.status(409).json({error:'Already exists'});
 if(err.code==='23503')return res.status(400).json({error:'Referenced record does not exist or is still in use'});
 if(err.code==='23514'||err.code==='22003'||err.code==='22P02')return res.status(400).json({error:'Invalid value'});
 if(err.code==='LIMIT_FILE_SIZE')return res.status(413).json({error:'File too large'});
 if(err.type==='entity.parse.failed')return res.status(400).json({error:'Malformed JSON'});
 console.error(err);res.status(500).json({error:'Internal server error'})}
