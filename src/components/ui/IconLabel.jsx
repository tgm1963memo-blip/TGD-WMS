// Icon + text pair that lines the SVG up with the text. The icon is decorative
// (aria-hidden) and inherits the surrounding text color.
export function IconLabel({ icon: Icon, size = 16, gap = 6, iconProps, children, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, ...style }}>
      <Icon size={size} aria-hidden="true" style={{ flexShrink: 0 }} {...iconProps} />
      {children}
    </span>
  );
}
