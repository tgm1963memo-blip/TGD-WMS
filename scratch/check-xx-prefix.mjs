import { readFileSync } from 'node:fs';
const refByTracking = JSON.parse(readFileSync('scratch/ref-by-tracking.json', 'utf8'));
const refCodes = Object.keys(refByTracking);
const xxInRef = refCodes.filter(c => c.startsWith('XX'));
console.log('XX-prefixed codes in reference:', xxInRef.length, 'of', refCodes.length);
console.log(JSON.stringify(xxInRef.slice(0, 10)));

const prefixes = new Set(refCodes.map(c => c.slice(0,2)));
console.log('distinct 2-char prefixes in reference:', [...prefixes]);
