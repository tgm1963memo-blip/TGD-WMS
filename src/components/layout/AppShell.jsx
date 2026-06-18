import { useState } from 'react';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';

export function AppShell({ currentSection, children }) {
  const goLive = isGoLivePresentationEnabled();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <Topbar currentSection={currentSection} onMenuToggle={() => setSidebarOpen((o) => !o)} />
          <main className="main-content app-content">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default AppShell;
