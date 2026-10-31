import fs from 'node:fs';import {q} from './pool.js';
export const migrate=()=>q(fs.readFileSync(new URL('../../sql/schema.sql',import.meta.url),'utf8'));
