export function detectUatErrors(textContent, currentUrl) {
  const errors = [];
  const warnings = [];

  let cleanText = textContent;

  const ignorePhrases = [
    'via RPC',
    'RPC logic unchanged',
    'movement-ledger only',
    'Production remains HOLD',
    'FINAL GO is NOT AUTHORIZED'
  ];

  for (const phrase of ignorePhrases) {
    if (textContent.toLowerCase().includes(phrase.toLowerCase())) {
      warnings.push(`Ignored expected phrase "${phrase}" on ${currentUrl}`);
    }
    // Escape string for regex, although simple strings are mostly fine
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleanText = cleanText.replace(regex, '');
  }

  const errorPhrases = [
    'rpc failed',
    'function not found',
    'schema cache',
    'permission denied',
    'table not found',
    'failed to fetch',
    'invalid login',
    'error:',
    'could not find',
    'violates row-level security',
    'JWT',
    'PGRST'
  ];

  for (const phrase of errorPhrases) {
    if (cleanText.toLowerCase().includes(phrase.toLowerCase())) {
      errors.push(`Found error phrase "${phrase}" on ${currentUrl}`);
    }
  }

  return { errors, warnings };
}
