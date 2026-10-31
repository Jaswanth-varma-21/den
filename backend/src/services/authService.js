import bcrypt from 'bcryptjs';import jwt from 'jsonwebtoken';import {randomUUID} from 'node:crypto';import {cfg} from '../config/index.js';import {q} from '../db/pool.js';import {HttpError} from '../utils/http.js';
const DUMMY=bcrypt.hashSync('dummy-password-1',4);
const issue=(u,role)=>({token:jwt.sign({role},cfg.jwtSecret,{subject:u.id,jwtid:randomUUID(),expiresIn:cfg.jwtTtl,algorithm:'HS256'}),user:{id:u.id,email:u.email,username:u.username,role}});
export async function register({email,username,password}){
 const hash=await bcrypt.hash(password,cfg.bcryptRounds);
 try{const r=await q(`INSERT INTO users(email,username,password_hash,role_id) VALUES($1,$2,$3,(SELECT id FROM roles WHERE name='user')) RETURNING id,email,username`,[email,username,hash]);return issue(r.rows[0],'user')}
 catch(e){if(e.code==='23505')throw new HttpError(409,'Email already registered');throw e}}
export async function login({email,password}){
 const r=await q(`SELECT u.id,u.email,u.username,u.password_hash,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE lower(u.email)=lower($1)`,[email]);
 const u=r.rows[0];const ok=await bcrypt.compare(password,u?u.password_hash:DUMMY);
 if(!u||!ok)throw new HttpError(401,'Invalid email or password');return issue(u,u.role)}
export async function logout(user){
 await q(`INSERT INTO token_denylist(jti,expires_at) VALUES($1,to_timestamp($2)) ON CONFLICT DO NOTHING`,[user.jti,user.exp]);
 await q(`DELETE FROM token_denylist WHERE expires_at<now()`)}
