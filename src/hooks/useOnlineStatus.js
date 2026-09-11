import { useEffect, useState } from 'react';

// navigator.onLine only reflects "connected to a network," not "can
// actually reach the server," but it's the only signal available without
// polling the backend -- combined with the online/offline events it's
// accurate enough to gate an offline-queue UI (a real failed request from
// the sync engine is the final word on reachability either way).
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
