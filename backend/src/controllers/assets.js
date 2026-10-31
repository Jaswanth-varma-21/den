import multer from 'multer';import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {cfg} from '../config/index.js';import {q} from '../db/pool.js';import {HttpError} from '../utils/http.js';
const MODEL=['.glb','.gltf'],IMG=['.png','.jpg','.jpeg','.webp'];
const KINDS={bottle_model:{ext:MODEL,max:20e6},bear_model:{ext:MODEL,max:50e6},environment_model:{ext:MODEL,max:50e6},texture:{ext:IMG,max:8e6},thumbnail:{ext:IMG,max:2e6},brand_logo:{ext:IMG,max:2e6}};
const MIME={'.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
const root=()=>path.resolve(cfg.uploadDir);
function magicOk(file,ext){const fd=fs.openSync(file,'r');const b=Buffer.alloc(512);const n=fs.readSync(fd,b,0,512,0);fs.closeSync(fd);const h=b.subarray(0,n);
 if(ext==='.glb')return h.subarray(0,4).toString('latin1')==='glTF';
 if(ext==='.gltf'){const s=h.toString('utf8').trimStart();return s.startsWith('{')}
 if(ext==='.png')return h.subarray(0,4).equals(Buffer.from([0x89,0x50,0x4e,0x47]));
 if(ext==='.jpg'||ext==='.jpeg')return h[0]===0xff&&h[1]===0xd8&&h[2]===0xff;
 if(ext==='.webp')return h.subarray(0,4).toString('latin1')==='RIFF'&&h.subarray(8,12).toString('latin1')==='WEBP';return false}
export async function upload(req,res){
 const kind=req.query.kind,k=KINDS[kind];if(!k)throw new HttpError(400,`kind must be one of: ${Object.keys(KINDS).join(', ')}`);
 const productId=req.query.productId?Number(req.query.productId):null,brandId=req.query.brandId?Number(req.query.brandId):null;
 if((productId!==null&&!Number.isInteger(productId))||(brandId!==null&&!Number.isInteger(brandId)))throw new HttpError(400,'Invalid productId/brandId');
 fs.mkdirSync(root(),{recursive:true});
 const up=multer({storage:multer.diskStorage({destination:root(),filename:(r,f,cb)=>cb(null,randomUUID()+path.extname(f.originalname).toLowerCase())}),limits:{fileSize:k.max,files:1},
  fileFilter:(r,f,cb)=>k.ext.includes(path.extname(f.originalname).toLowerCase())?cb(null,true):cb(new HttpError(415,`Allowed types for ${kind}: ${k.ext.join(', ')}`))}).single('file');
 await new Promise((ok,no)=>up(req,res,e=>e?no(e):ok()));
 if(!req.file)throw new HttpError(400,'file is required (multipart field "file")');
 const ext=path.extname(req.file.filename);
 if(!magicOk(req.file.path,ext)){fs.unlinkSync(req.file.path);throw new HttpError(415,'File content does not match its type')}
 const url='/api/assets/file/'+req.file.filename;
 try{const r=await q(`INSERT INTO assets(kind,product_id,brand_id,original_name,stored_name,mime,size_bytes,url,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,kind,url,mime,size_bytes AS "sizeBytes"`,
   [kind,productId,brandId,path.basename(req.file.originalname).slice(0,200),req.file.filename,MIME[ext],req.file.size,url,req.user.id]);
  if(productId&&kind==='bottle_model')await q('UPDATE products SET model_url=$1,updated_at=now() WHERE id=$2',[url,productId]);
  if(productId&&kind==='thumbnail')await q('UPDATE products SET bottle_image_url=$1,updated_at=now() WHERE id=$2',[url,productId]);
  if(brandId&&kind==='brand_logo')await q('UPDATE brands SET logo_url=$1,updated_at=now() WHERE id=$2',[url,brandId]);
  res.status(201).json(r.rows[0])}catch(e){fs.unlinkSync(req.file.path);throw e}}
export function serve(req,res,next){const n=req.params.name;if(!/^[0-9a-f-]{36}\.(glb|gltf|png|jpe?g|webp)$/.test(n))return next(new HttpError(404,'Not found'));
 res.set({'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600','Content-Type':MIME[path.extname(n)]});
 res.sendFile(n,{root:root()},e=>{if(e)next(new HttpError(404,'Not found'))})}
export const list=async(req,res)=>res.json({items:(await q(`SELECT id,kind,url,mime,size_bytes AS "sizeBytes",product_id AS "productId",brand_id AS "brandId",original_name AS "originalName",created_at AS "createdAt" FROM assets ORDER BY created_at DESC LIMIT 200`)).rows});
