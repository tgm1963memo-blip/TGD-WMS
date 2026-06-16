import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';

export function PageShell({ title, description, children, className = 'page-shell' }) {
  const goLive = isGoLivePresentationEnabled();

  return (
    <section className={getPageShellClassName(className)}>
      <div className="page-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {!goLive ? <p className="sprint-status">Sprint status: placeholder only</p> : null}
      {children}
    </section>
  );
}
