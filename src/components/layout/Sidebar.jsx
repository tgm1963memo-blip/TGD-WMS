import React from 'react';
import { NavLink } from 'react-router-dom';
import { navigationGroups } from '../../app/navigation.js';
import { brandConfig } from '../../config/brandConfig.js';

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
  return (
    <aside
      className="sidebar"
      aria-label="Primary navigation"
      data-testid="sidebar"
    >
      <nav aria-label="TGD WMS navigation">
        {navigationGroups.map((group) => (
          <div key={group.key}>
            <p className="nav-group-label">{group.label}</p>
            <div className="nav-list">
              {group.items.map((item) => {
                if (item.disabled) {
                  return (
                    <span
                      key={item.key}
                      className="nav-link disabled"
                      aria-disabled="true"
                      title="Coming soon"
                    >
                      {item.label}
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
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
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
