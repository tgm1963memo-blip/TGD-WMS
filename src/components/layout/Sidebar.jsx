import React from 'react';
import { NavLink } from 'react-router-dom';
import { navigationGroups } from '../../app/navigation.js';
import { brandConfig } from '../../config/brandConfig.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { UserSessionMenu } from '../auth/UserSessionMenu.jsx';
import { useUserRole } from '../../features/auth/UserRoleProvider.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { isNavigationGroupVisible, isNavigationItemVisible } from '../../config/navigationPresentation.js';
import {
  filterNavigationGroupsForRole,
} from '../../security/navigationPermissions.js';

/**
 * Professional Black & Gold sidebar navigation (approved mockup style).
 */
export function Sidebar({ isOpen, onClose }) {
  const t = useTranslation();
  const { role: userRole } = useUserRole();
  const goLive = isGoLivePresentationEnabled();

  const toCamelCase = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const getNavKey = (key) => `nav.${toCamelCase(key)}`;

  const visibleGroups = filterNavigationGroupsForRole(
    navigationGroups.filter((group) => isNavigationGroupVisible(group.key)),
    userRole,
  ).map((group) => ({
    ...group,
    items: group.items.filter((item) => isNavigationItemVisible(item.key)),
  })).map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.disabled),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className={`sidebar app-sidebar${isOpen ? ' sidebar--mobile-open' : ''}`} aria-label="Primary navigation" data-testid="sidebar">
      <div className="sidebar-header tgm-sidebar-brand">
        <img alt="TGC logo" className="tgm-sidebar-logo" src={brandConfig.logoPath} />
        <span className="sidebar-header-title">TGC WMS</span>
      </div>

      <nav className="sidebar-nav" aria-label="TGC WMS navigation">
        {visibleGroups.map((group) => (
            <div key={group.key} className="sidebar-nav-group">
              <p className="nav-group-label">{group.label}</p>
              <div className="nav-list">
                {group.items.map((item) => {
                  const itemLabel = t(getNavKey(item.key)) || item.label;
                  return (
                    <NavLink
                      key={item.key}
                      className={({ isActive }) =>
                        isActive ? 'nav-link nav-item active' : 'nav-link nav-item'
                      }
                      to={item.path}
                      end
                      data-testid={item.testId}
                      onClick={onClose}
                    >
                      {itemLabel}
                    </NavLink>
                  );
                })}
              </div>
            </div>
        ))}
      </nav>

      <UserSessionMenu />

      {!goLive ? (
        <div
          className="production-hold-banner sidebar-hold-banner"
          data-testid="production-hold-indicator"
          role="status"
          aria-label="Production status"
        >
          Production HOLD
        </div>
      ) : null}
    </aside>
  );
}
