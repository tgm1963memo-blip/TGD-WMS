import React from 'react';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

/**
 * AppShell – main layout shell for the Black & Gold Professional theme.
 * Provides the topbar + sidebar + main content grid.
 */
export function AppShell({ currentSection, children }) {
  return (
    <div className="app-shell" data-testid="app-shell">
      <Topbar currentSection={currentSection} />
      <div className="app-body">
        <Sidebar />
        <main
          className="main-content"
          style={{
            maxWidth: 1440,
            padding: '28px clamp(16px, 3vw, 36px)',
            width: '100%',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
