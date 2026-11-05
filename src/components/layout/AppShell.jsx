import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { CommandPalette, isCommandPaletteShortcut } from './CommandPalette.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';

export function AppShell({ currentSection, sectionLabel = null, children }) {
  const goLive = isGoLivePresentationEnabled();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (!isCommandPaletteShortcut(e)) return;
      e.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`app-shell${goLive ? ' app-shell--golive' : ''}`} data-testid="app-shell">
      {!goLive ? (
        <div
          className="banner banner-warning uat-safety-banner"
          role="status"
          aria-label="UAT environment status"
        >
          CONTROLLED UAT ENVIRONMENT - PRODUCTION REMAINS HOLD - FINAL GO IS NOT AUTHORIZED
        </div>
      ) : null}
      <div className="app-body">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="sidebar-mobile-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="app-main">
          <Topbar currentSection={currentSection} sectionLabel={sectionLabel} onMenuToggle={() => setSidebarOpen((o) => !o)} onSearch={() => setSearchOpen(true)} />
          <main className="main-content app-content">{children}</main>
        </div>
      </div>
      {searchOpen ? <CommandPalette isOpen onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}

export default AppShell;
