// src/components/common/UserRoleDemoSelector.jsx

import React from 'react';
import { getCurrentUserRole, setDemoUserRole, listAvailableDemoRoles } from '../../security/currentUserRole.js';
import { brandConfig } from '../../config/brandConfig.js';

/**
 * Demo‑only role selector UI.
 * Displays the current demo role and allows switching in‑memory.
 * Clearly labelled as frontend‑only and NOT production authentication.
 */
export default function UserRoleDemoSelector() {
  const currentRole = getCurrentUserRole();
  const demoRoles = listAvailableDemoRoles();

  const handleChange = (e) => {
    setDemoUserRole(e.target.value);
    // Force re‑render by updating local state (optional).
    // Since the role source is global, a full page reload is not required.
    // Here we simply trigger a state update to reflect the change.
    window.location.reload(); // Simplest way to reflect role change in demo.
  };

  return (
    <div
      style={{
        background: brandConfig.colors.goldSoft,
        border: `1px solid ${brandConfig.colors.gold}`,
        borderRadius: brandConfig.ui.borderRadius,
        boxShadow: '0 10px 28px rgba(214, 161, 31, 0.18)',
        color: '#5f3a00',
        marginBottom: '1rem',
        padding: '12px 14px',
      }}
    >
      <strong>สำหรับทดสอบเท่านั้น / Demo only – frontend role selector (not production auth)</strong>
      <p style={{ margin: '4px 0 10px' }}>Frontend role selector (not production auth)</p>
      <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span>Current role:</span>
        <code>{currentRole}</code>
        <label htmlFor="demo-role-select">Switch role:</label>
      </div>
      <select
        id="demo-role-select"
        value={currentRole}
        onChange={handleChange}
        style={{
          border: '1px solid #d9a441',
          borderRadius: 6,
          marginTop: 8,
          minHeight: 36,
          padding: '6px 10px',
        }}
      >
        {demoRoles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    </div>
  );
}
