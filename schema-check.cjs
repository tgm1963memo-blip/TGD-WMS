require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tgd_customer_product_service_rates'
  `);
  console.log('tgd_customer_product_service_rates columns:', res.rows);

  const res2 = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'service_type_enum' OR t.typname = 'service_type'
  `);
  console.log('Enum types:', res2.rows);

  await client.end();
}
run().catch(console.error);
