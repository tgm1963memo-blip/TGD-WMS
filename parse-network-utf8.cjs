const fs = require('fs');
const readline = require('readline');
const filePath = 'test-results/temp_trace/0-trace.network';

async function processLineByLine() {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    if (!line.trim()) continue;
    const evt = JSON.parse(line);
    const type = evt.type;
    if (type === 'resource-snapshot') {
       const req = evt.snapshot.request;
       const res = evt.snapshot.response;
       if (req.url.includes('supabase')) {
          console.log('URL: ' + req.url);
          console.log('Method: ' + req.method);
          console.log('Status: ' + (res ? res.status : 'PENDING'));
          if (evt.snapshot.timings) {
             const wait = evt.snapshot.timings.wait;
             console.log('Wait: ' + wait + 'ms');
          }
          console.log('---');
       }
    }
  }
}
processLineByLine();
