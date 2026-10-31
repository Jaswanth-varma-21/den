import {q} from './pool.js';
// Placeholder DEMO prices (INR, paise) by category. Admins edit them; existing prices are never overwritten.
export const seedPrices=async()=>(await q(`INSERT INTO product_prices(product_id,price_minor) SELECT p.id,(CASE c.slug WHEN 'whisky' THEN 3500 WHEN 'vodka' THEN 1800 WHEN 'rum' THEN 1600 WHEN 'gin' THEN 2400 WHEN 'tequila' THEN 3200 WHEN 'wine' THEN 1400 WHEN 'champagne' THEN 6500 WHEN 'beer' THEN 250 WHEN 'cognac' THEN 4500 ELSE 2000 END)*100 FROM products p JOIN categories c ON c.id=p.category_id ON CONFLICT DO NOTHING`)).rowCount;
