import {z} from 'zod';
const id=z.coerce.number().int().positive();
const url=z.string().max(500).regex(/^(https?:\/\/|\/api\/assets\/file\/)/,'must be http(s) or an uploaded asset url');
const txt=n=>z.string().max(n);
export const idParam=z.object({id});
export const listQuery=z.object({page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(20),
 q:z.string().trim().max(100).optional(),country:z.string().trim().max(60).optional(),category:z.string().trim().max(60).optional(),brandId:id.optional(),
 sort:z.enum(['id','name','brand','abv','newest']).default('id'),dir:z.enum(['asc','desc']).default('asc')});
export const register=z.object({email:z.string().trim().toLowerCase().email().max(200),username:z.string().trim().min(2).max(40),
 password:z.string().min(8).max(72).regex(/[A-Za-z]/,'needs a letter').regex(/\d/,'needs a digit')});
export const login=z.object({email:z.string().trim().toLowerCase().email(),password:z.string().min(1).max(72)});
export const brandBody=z.object({name:z.string().trim().min(1).max(120),countryId:id,categoryId:id,description:txt(4000).optional(),logoUrl:url.optional(),foundedYear:z.number().int().min(1000).max(2100).optional()});
export const brandPatch=brandBody.partial();
export const historyBody=z.object({year:z.number().int().min(1000).max(2100).optional(),event:z.string().trim().min(1).max(1000)});
export const productBody=z.object({brandId:id,categoryId:id,countryId:id,name:z.string().trim().min(1).max(160),description:txt(4000).optional(),history:txt(4000).optional(),
 abv:z.number().min(0).max(100).nullable().optional(),abvNote:txt(120).optional(),bottleImageUrl:url.optional(),modelUrl:url.optional(),specs:z.record(z.any()).optional(),color:z.number().int().min(0).max(0xffffff).optional()});
export const productPatch=productBody.partial();
export const variantBody=z.object({name:z.string().trim().min(1).max(120),abv:z.number().min(0).max(100).nullable().optional(),sizeMl:z.number().int().positive().max(100000).optional()});
export const nameBody=z.object({name:z.string().trim().min(1).max(80),slug:z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(60).optional(),code:z.string().trim().max(10).optional()});
export const collectionBody=z.object({name:z.string().trim().min(1).max(80)});
export const roleBody=z.object({role:z.enum(['user','admin'])});
export const trackBody=z.object({type:z.enum(['visit','view','navigate']),entityType:z.enum(['product','brand','room','category']).optional(),entityId:z.number().int().positive().optional(),sessionId:z.string().max(64).optional()});
export const cartAdd=z.object({productId:id,quantity:z.number().int().min(1).max(20).default(1)}).strict();
export const cartPatch=z.object({quantity:z.number().int().min(1).max(20)}).strict();
export const checkoutBody=z.object({customerName:z.string().trim().max(80).optional()}).strict();
export const priceBody=z.object({priceMinor:z.number().int().min(0).max(100000000),currency:z.string().regex(/^[A-Z]{3}$/).default('INR'),discountBp:z.number().int().min(0).max(10000).default(0),status:z.enum(['available','limited','unavailable']).default('available')}).strict();
