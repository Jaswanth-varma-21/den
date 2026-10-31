import 'dotenv/config';
export const cfg={env:process.env.NODE_ENV||'development',port:+process.env.PORT||3000,
 db:process.env.DATABASE_URL||'postgres://postgres:postgres@localhost:5432/bears_den',
 jwtSecret:process.env.JWT_SECRET,jwtTtl:process.env.JWT_TTL||'1h',bcryptRounds:+process.env.BCRYPT_ROUNDS||12,
 cors:(process.env.CORS_ORIGINS||'http://localhost:3000').split(',').map(s=>s.trim()),
 uploadDir:process.env.UPLOAD_DIR||'./uploads',rate:{max:+process.env.RATE_MAX||300,authMax:+process.env.AUTH_RATE_MAX||20,checkoutMax:+process.env.CHECKOUT_RATE_MAX||30},
 demo:{taxBp:process.env.DEMO_TAX_BP?+process.env.DEMO_TAX_BP:1800,ttlMin:+process.env.DEMO_SESSION_TTL_MIN||30,publicUrl:process.env.PUBLIC_BASE_URL||`http://localhost:${+process.env.PORT||3000}`}};
if(!cfg.jwtSecret||cfg.jwtSecret.length<32)throw new Error('JWT_SECRET must be set to a random string of at least 32 characters');
