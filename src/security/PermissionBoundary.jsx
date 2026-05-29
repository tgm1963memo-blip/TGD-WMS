// src/security/PermissionBoundary.jsx
import React from 'react';
import { getRouteAccessDecision } from './permissionGuard';

/**
 * PermissionBoundary – frontend display guard.
 * Renders `children` when the current user role is allowed for the given routePath.
 * Otherwise renders the optional `fallback` element (defaults to null).
 * No redirects, no side effects, pure UI component.
 */
export default function PermissionBoundary({ userRole, routePath, children, fallback = null }) {
  const decision = getRouteAccessDecision(userRole, routePath);
  return decision.allowed ? children : fallback;
}
