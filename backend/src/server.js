import app from './app.js';import {cfg} from './config/index.js';import {pool} from './db/pool.js';
const s=app.listen(cfg.port,()=>console.log(`The Bear's Den running on http://localhost:${cfg.port}`));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>s.close(()=>pool.end().then(()=>process.exit(0))));
