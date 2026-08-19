import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findRPF024() {
  const res = await fetch(url);
  const json = await res.json();
  const definitions = json.definitions;
  
  if (!definitions) {
      console.log('No definitions found.');
      return;
  }
  
  for (const [tableName, definition] of Object.entries(definitions)) {
    if (definition.properties) {
      const stringColumns = Object.entries(definition.properties)
        .filter(([k, v]) => v.type === 'string' && v.format !== 'uuid' && v.format !== 'timestamp with time zone' && v.format !== 'timestamp without time zone')
        .map(([k, v]) => k);
        
      if (stringColumns.length > 0) {
        try {
          const orQuery = stringColumns.map(c => `${c}.eq.RPF024`).join(',');
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .or(orQuery)
            .limit(10);
            
          if (error) {
            // some views might not be queryable this way or permissions
            continue;
          }
          if (data && data.length > 0) {
            console.log(`Found RPF024 in table ${tableName}!`);
            const matchedColumns = stringColumns.filter(col => data.some(row => row[col] === 'RPF024'));
            console.log(`Matched columns: ${matchedColumns.join(', ')}`);
            console.log(`Row count matched: ${data.length} (showing up to 10)`);
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }
  
  console.log('Done searching for RPF024');
}

findRPF024();
