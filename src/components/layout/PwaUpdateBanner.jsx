import { useEffect, useState } from 'react';

// How often an open tab asks the server whether a newer build was deployed.
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

// The service worker precaches the app, so an open tab keeps running the build
// it first loaded even after a new deploy. This registers the service worker,
// checks for a new deploy periodically and whenever the tab comes back into
// view, and — once the new version has taken over — asks the user to reload
// instead of reloading on its own and wiping a form they are filling in.
export function PwaUpdateBanner() {
  const [needReload, setNeedReload] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    let intervalId = null;
    let registration = null;
    const checkForUpdate = () => { registration?.update().catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate(); };

    import('workbox-window').then(({ Workbox }) => {
      const wb = new Workbox('/sw.js', { scope: '/' });
      // The service worker skips waiting and claims open tabs, so "controlling"
      // with isUpdate means a new build now serves this tab's next load.
      wb.addEventListener('controlling', (event) => {
        if (event.isUpdate) setNeedReload(true);
      });
      wb.register().then((reg) => {
        registration = reg ?? null;
        intervalId = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
        document.addEventListener('visibilitychange', onVisible);
      }).catch(() => {});
    }).catch(() => {});

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!needReload) return null;

  return (
    <div
      className="banner banner-info"
      role="status"
      data-testid="pwa-update-banner"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000, display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}
    >
      <span>มีระบบเวอร์ชันใหม่ กรุณาบันทึกงานที่ทำค้างไว้ แล้วกดโหลดใหม่</span>
      <button className="btn btn-primary btn-sm" type="button" onClick={() => window.location.reload()}>
        โหลดใหม่
      </button>
    </div>
  );
}
