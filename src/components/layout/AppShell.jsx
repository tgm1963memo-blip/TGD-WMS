import React from 'react';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { brandConfig } from '../../config/brandConfig.js';

export function AppShell({ currentSection, children }) {
  return (
    <div className="app-shell tgm-app-shell" style={{ background: brandConfig.colors.gray, minHeight: '100vh' }}>
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
