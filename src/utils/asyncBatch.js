// Runs `fn` over `items` with at most `limit` calls in flight at once,
// preserving result order. Firing one request per item via a bare
// Promise.all works fine for a handful of items (e.g. 2-3 documents merged
// for print) but stalls the browser's connection pool -- and with it every
// other in-flight request on the page -- once a filtered list grows into
// the hundreds, which is exactly what an "export every currently filtered
// row" action can hit in a live warehouse with months of request history.
export async function mapWithConcurrencyLimit(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
