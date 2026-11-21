import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { navigationGroups } from '../../app/navigation.js';
import { buildSidebarSections, getNavigationItemIcon } from '../../app/navigationSections.js';
import { brandConfig } from '../../config/brandConfig.js';
import { useLanguage, useTranslation } from '../../i18n/languageProvider.jsx';
import { UserSessionMenu } from '../auth/UserSessionMenu.jsx';
import { useUserRole } from '../../features/auth/UserRoleProvider.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { isNavigationGroupVisible, isNavigationItemVisible } from '../../config/navigationPresentation.js';
import {
  filterNavigationGroupsForRole,
} from '../../security/navigationPermissions.js';

const COLLAPSE_STORAGE_KEY = 'tgd.sidebar.collapsedSections';

function readCollapsed() {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set(['settings']);
  } catch {
    return new Set(['settings']);
  }
}

function writeCollapsed(set) {
  try { window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify([...set])); } catch { /* per-viewer convenience only */ }
}

function sectionContainsPath(section, pathname) {
  return section.items.some((item) => item.path && (pathname === item.path || pathname.startsWith(`${item.path}/`)));
}

/**
 * Sidebar: ink rail, permission-filtered groups folded into a few
 * job-based sections (see navigationSections.js). "ตั้งค่าระบบ" collapses.
 */
export function Sidebar({ isOpen, onClose }) {
  const t = useTranslation();
  const { language } = useLanguage();
  const { pathname } = useLocation();
  const { role: userRole, allowedMenuKeys } = useUserRole();
  const goLive = isGoLivePresentationEnabled();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toCamelCase = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const getNavKey = (key) => `nav.${toCamelCase(key)}`;

  const visibleGroups = filterNavigationGroupsForRole(
    navigationGroups.filter((group) => isNavigationGroupVisible(group.key)),
    userRole,
    allowedMenuKeys,
  ).map((group) => ({
    ...group,
    items: group.items.filter((item) => isNavigationItemVisible(item.key) && !item.disabled),
  })).filter((group) => group.items.length > 0);

  const sections = buildSidebarSections(visibleGroups, language);

  // Landing on a page inside a collapsed section opens it, so the active
  // item is never hidden.
  useEffect(() => {
    const activeCollapsed = sections.find((s) => s.collapsible && collapsed.has(s.key) && sectionContainsPath(s, pathname));
    if (activeCollapsed) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(activeCollapsed.key);
        writeCollapsed(next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleSection(key) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      writeCollapsed(next);
      return next;
    });
  }

  return (
    <aside className={`sidebar app-sidebar${isOpen ? ' sidebar--mobile-open' : ''}`} aria-label="Primary navigation" data-testid="sidebar">
      <div className="sidebar-header tgm-sidebar-brand">
        <img alt="TGC logo" className="tgm-sidebar-logo" src={brandConfig.logoPath} />
        <div className="sidebar-brand-text">
          <span className="sidebar-header-title">TGC WMS</span>
          <span className="sidebar-header-sub">TG Cold Storage</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="TGC WMS navigation">
        {sections.map((section) => {
          const isCollapsed = section.collapsible && collapsed.has(section.key);
          const listId = `sidebar-section-${section.key}`;
          return (
            <div key={section.key} className="sidebar-nav-group" data-section={section.key}>
              {section.collapsible ? (
                <button
                  type="button"
                  className="nav-group-label nav-group-toggle"
                  aria-expanded={!isCollapsed}
                  aria-controls={listId}
                  onClick={() => toggleSection(section.key)}
                >
                  <span>{section.label}</span>
                  <ChevronDown size={14} aria-hidden="true" className="nav-group-chevron" />
                </button>
              ) : (
                <p className="nav-group-label">{section.label}</p>
              )}
              <div className="nav-list" id={listId} hidden={isCollapsed}>
                {section.items.map((item) => {
                  const itemLabel = t(getNavKey(item.key)) || item.label;
                  const Icon = getNavigationItemIcon(item.key);
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
                      <Icon size={17} strokeWidth={1.8} aria-hidden="true" className="nav-icon" />
                      <span className="nav-text">{itemLabel}</span>
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
