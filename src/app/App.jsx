import { AppProviders } from './providers.jsx';
import { AppRoutes } from './routes.jsx';
import AppErrorBoundary from '../components/common/AppErrorBoundary.jsx';
import AppLanguageShell from '../components/common/AppLanguageShell.jsx';

export default function App() {
  return (
    <AppErrorBoundary><AppLanguageShell><AppProviders><AppRoutes /></AppProviders></AppLanguageShell></AppErrorBoundary>
  );
}
