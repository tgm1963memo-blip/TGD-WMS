import { SectionCard } from '../layout/SectionCard.jsx';

export function DocumentSection({ title, children }) {
  return (
    <SectionCard title={title}>
      {children}
    </SectionCard>
  );
}
