const fs = require('fs');
const readline = require('readline');
async function processLineByLine() {
  const fileStream = fs.createReadStream('test-results/temp_trace_9/0-trace.network');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const urls = {};
  for await (const line of rl) {
    if (!line.trim()) continue;
    const evt = JSON.parse(line);
    if (evt.type === 'resource-snapshot') {
      const url = evt.snapshot.request.url;
      urls[url] = (urls[url] || 0) + 1;
    }
  }
  console.log('Network counts:');
  Object.entries(urls).sort((a,b)=>b[1]-a[1]).forEach(([url, count]) => console.log(`${count} URL: ${url}`));
}
processLineByLine();
