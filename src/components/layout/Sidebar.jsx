import React from 'react';
import { NavLink } from 'react-router-dom';
import { navigationGroups } from '../../app/navigation.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

/**
 * Professional Black & Gold sidebar navigation.
 *
 * Rules from 17A design spec:
 * - Full professional text labels.
 * - No emoji icons.
 * - No short code-only labels.
 * - Gold active/hover accent.
 * - Professional group labels.
 * - Disabled items shown as greyed out.
 * - Production HOLD indicator.
 */
export function Sidebar() {
  const t = useTranslation();

  const toCamelCase = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const getNavKey = (key) => `nav.${toCamelCase(key)}`;

  return (
    <aside
      className="sidebar"
      aria-label="Primary navigation"
      data-testid="sidebar"
    >
      <nav aria-label="TGD WMS navigation">
        {navigationGroups.map((group) => {
          // 17B: professional English group labels regardless of UI language
          const groupLabel = group.label;
          return (
            <div key={group.key}>
              <p className="nav-group-label">{groupLabel}</p>
              <div className="nav-list">
                {group.items.map((item) => {
                  const itemLabel = t(getNavKey(item.key)) || item.label;
                  if (item.disabled) {
                    return (
                      <span
                        key={item.key}
                        className="nav-link disabled"
                        aria-disabled="true"
                        title="Coming soon"
                      >
                        {itemLabel}
                      </span>
                    );
                  }

                  return (
                    <NavLink
                      key={item.key}
                      className={({ isActive }) =>
                        isActive ? 'nav-link active' : 'nav-link'
                      }
                      to={item.path}
                    >
                      {itemLabel}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Production HOLD safety indicator */}
      <div
        className="production-hold-banner"
        data-testid="production-hold-indicator"
        role="status"
        aria-label="Production status"
      >
        Production HOLD
      </div>
    </aside>
  );
}
