import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fetchSchema() {
  const res = await fetch(url);
  const json = await res.json();
  const definitions = json.definitions;
  
  if (!definitions) {
      console.log('No definitions found.');
      return;
  }
  
  const tablesWithProductCode = [];
  
  for (const [tableName, definition] of Object.entries(definitions)) {
    if (definition.properties) {
      const properties = Object.keys(definition.properties);
      const match = properties.find(p => p.toLowerCase().includes('product') || p.toLowerCase().includes('code'));
      if (match) {
        tablesWithProductCode.push({ tableName, match, allColumns: properties });
      }
    }
  }
  
  console.log('Tables with potential product columns:');
  console.log(JSON.stringify(tablesWithProductCode, null, 2));
}

fetchSchema();
