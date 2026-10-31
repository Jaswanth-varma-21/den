import pg from 'pg';import {cfg} from '../config/index.js';
export const pool=new pg.Pool({connectionString:cfg.db,max:10});
export const q=(text,params)=>pool.query(text,params);
