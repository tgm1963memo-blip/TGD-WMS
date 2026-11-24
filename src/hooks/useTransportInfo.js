import { useEffect, useState } from 'react';
import { getDocumentTransportInfo } from '../services/transportInfoService.js';

// Seal number + driver name for a printed deposit / withdrawal. Returns the
// header's own values when the caller already loaded them, otherwise reads
// them once (null until loaded or when unavailable).
export function useTransportInfo(documentType, header) {
  const requestId = header?.id ?? null;
  const preloaded = header && (header.seal_no !== undefined || header.driver_name !== undefined);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!requestId || preloaded) return undefined;
    let current = true;
    getDocumentTransportInfo(documentType, requestId).then(({ data, error }) => {
      if (current && !error) setInfo(data ?? null);
    });
    return () => { current = false; };
  }, [documentType, requestId, preloaded]);

  if (preloaded) return { seal_no: header.seal_no ?? null, driver_name: header.driver_name ?? null };
  return info;
}
