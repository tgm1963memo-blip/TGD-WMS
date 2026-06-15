import React from 'react';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';

/**
 * AppShell – approved mockup layout: UAT banner + sidebar + main column.
 */
export function AppShell({ currentSection, children }) {
  const goLive = isGoLivePresentationEnabled();

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
        <Sidebar />
        <div className="app-main">
          <Topbar currentSection={currentSection} />
          <main className="main-content app-content">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default AppShell;
