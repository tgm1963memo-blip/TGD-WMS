import { Outlet } from 'react-router-dom';
import { Header } from './Header.jsx';
import { Sidebar } from './Sidebar.jsx';

export function MainLayout() {
  return (
    <div className="app-layout">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="main-content" aria-label="Page content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

