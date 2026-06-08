import React from 'react';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

/**
 * AppShell – approved mockup layout: UAT banner + sidebar + main column.
 */
export function AppShell({ currentSection, children }) {
  return (
    <div className="app-shell" data-testid="app-shell">
      <div
        className="banner banner-warning uat-safety-banner"
        role="status"
        aria-label="UAT environment status"
      >
        CONTROLLED UAT ENVIRONMENT - PRODUCTION REMAINS HOLD - FINAL GO IS NOT AUTHORIZED
      </div>
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
