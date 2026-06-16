import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { UatOnly } from '../../components/common/UatOnly.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';

export function SettingsPage() {
  return (
    <section className={getPageShellClassName()}>
      <PageHeader title="Settings" description="Settings placeholder." />
      <UatOnly><p className="sprint-status">Sprint status: placeholder only</p></UatOnly>
    </section>
  );
}
