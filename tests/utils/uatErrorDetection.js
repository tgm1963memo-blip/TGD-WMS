const SAFE_NONE_ERROR_DIAGNOSTIC_LINE = /^[A-Za-z0-9 _-]+ error:\s*None$/i;

/**
 * Remove diagnostic lines that are safe (value None) before scanning for errors.
 * This ensures lines like "Save draft RPC error: None" are ignored.
 */
export function sanitizeUatBodyTextForErrorScan(bodyText = '') {
  return String(bodyText)
    .split(/\r?\n/)
    .filter((line) => !SAFE_NONE_ERROR_DIAGNOSTIC_LINE.test(line.trim()))
    .join('\n');
}

/** Backward compatible helper used elsewhere */
export function sanitizeUatBodyText(bodyText) {
  return sanitizeUatBodyTextForErrorScan(bodyText);
}

export function detectUatErrors(textContent, currentUrl) {
  const errors = [];
  const warnings = [];

  // Use sanitized text to avoid false positives from safe diagnostics
  let cleanText = sanitizeUatBodyText(textContent);

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
