const ZERO_WIDTH_SPACE = '​';

// Guarantees a line-break opportunity every `chunkSize` graphemes,
// independent of CSS overflow-wrap/word-break support in whatever print
// rendering pipeline is being used. Thai text commonly has zero natural
// word-break points (no spaces between words), so a long unbroken product
// name or customer name can otherwise overflow its container/table cell
// instead of wrapping — that's shown up as text overlapping the next
// column on a printed document even with overflow-wrap: break-word set.
//
// Splits by grapheme cluster (via Intl.Segmenter), not raw UTF-16 code
// units — Thai vowels/tone marks are separate combining code points that
// visually attach to the preceding base consonant, so chunking by
// `.length` risks landing a break exactly between a base character and
// its combiner, which would render the mark detached/orphaned on the
// wrapped line — the same "garbled Thai text" failure mode this is meant
// to fix, just from a different cause.
export function insertSoftBreaks(text, chunkSize = 8) {
  if (text == null) return text;
  const s = String(text);
  if (s.length <= chunkSize) return s;

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const graphemes = [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(s)]
      .map((entry) => entry.segment);
    if (graphemes.length <= chunkSize) return s;
    const chunks = [];
    for (let i = 0; i < graphemes.length; i += chunkSize) {
      chunks.push(graphemes.slice(i, i + chunkSize).join(''));
    }
    return chunks.join(ZERO_WIDTH_SPACE);
  }

  // Fallback for environments without Intl.Segmenter (rare, older browser
  // print engines) — small residual risk of splitting a base+combining-mark
  // pair, but still far better than never breaking at all.
  return s.replace(new RegExp(`(.{${chunkSize}})`, 'g'), `$1${ZERO_WIDTH_SPACE}`);
}
