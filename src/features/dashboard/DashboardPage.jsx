import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  return (
    <section className="page-shell">
      <PageHeader title="Dashboard" description="Operational overview placeholder for the UI foundation." />
      <p className="sprint-status">Sprint status: placeholder only</p>
      <Link className="action-link" to="/dashboard/inventory">Open inventory dashboard</Link>
    </section>
  );
}
