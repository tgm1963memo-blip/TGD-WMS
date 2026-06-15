import React from 'react';
import { NavLink } from 'react-router-dom';
import { navigationGroups } from '../../app/navigation.js';
import { brandConfig } from '../../config/brandConfig.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { UserSessionMenu } from '../auth/UserSessionMenu.jsx';
import { useUserRole } from '../../features/auth/UserRoleProvider.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { isBillingNavigationItemVisible } from '../../security/billingInvoiceDraftPermissions.js';
import {
  isCustomerOpsDemoNavigationVisible,
  isCustomerPortalNavigationVisible,
} from '../../security/customerPortalPermissions.js';

/**
 * Professional Black & Gold sidebar navigation (approved mockup style).
 */
export function Sidebar() {
  const t = useTranslation();
  const { role: userRole } = useUserRole();
  const goLive = isGoLivePresentationEnabled();

  const toCamelCase = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const getNavKey = (key) => `nav.${toCamelCase(key)}`;

  return (
    <aside className="sidebar app-sidebar" aria-label="Primary navigation" data-testid="sidebar">
      <div className="sidebar-header tgm-sidebar-brand">
        <img alt="TGM logo" className="tgm-sidebar-logo" src={brandConfig.logoPath} />
        <span className="sidebar-header-title">TGD WMS</span>
      </div>

      <nav className="sidebar-nav" aria-label="TGD WMS navigation">
        {navigationGroups.map((group) => {
          if (group.key === 'customer_ops_demo' && !isCustomerOpsDemoNavigationVisible(userRole)) {
            return null;
          }

          const groupLabel = group.label;
          return (
            <div key={group.key} className="sidebar-nav-group">
              <p className="nav-group-label">{groupLabel}</p>
              <div className="nav-list">
                {group.items.map((item) => {
                  if (group.key === 'customer_portal' && !isCustomerPortalNavigationVisible(userRole)) {
                    return null;
                  }

                  if (!isBillingNavigationItemVisible(item.key, userRole)) {
                    return null;
                  }

                  const itemLabel = t(getNavKey(item.key)) || item.label;
                  if (item.disabled) {
                    return (
                      <span
                        key={item.key}
                        className="nav-link nav-item disabled"
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
                        isActive ? 'nav-link nav-item active' : 'nav-link nav-item'
                      }
                      to={item.path}
                      data-testid={item.testId}
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
