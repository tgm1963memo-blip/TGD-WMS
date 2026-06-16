import { Navigate } from 'react-router-dom';

export function InventoryDashboardPage() {
  return <Navigate to="/dashboard#inventory" replace />;
}
