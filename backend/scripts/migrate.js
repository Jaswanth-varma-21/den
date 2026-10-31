import {migrate} from '../src/db/migrate.js';import {pool} from '../src/db/pool.js';
await migrate();console.log('Schema applied.');await pool.end();
