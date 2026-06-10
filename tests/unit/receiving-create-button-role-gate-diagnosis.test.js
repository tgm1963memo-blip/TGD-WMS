import { describe, it, expect, vi } from 'vitest';
import { getCurrentUserRole, PRODUCTION_FALLBACK_ROLE } from '../../src/security/currentUserRole.js';
import * as demoRoleSelectorControl from '../../src/security/demoRoleSelectorControl.js';
import { hasRoleAccess } from '../../src/security/permissionGuard.js';

describe('23C Diagnosis: Receiving Create Button Role Gate', () => {
  it('should deny warehouse_staff access when production fallback role (viewer) is applied', () => {
    // Mock the environment to appear as Production where demo selector is not allowed
    vi.spyOn(demoRoleSelectorControl, 'isDemoRoleSelectorAllowed').mockReturnValue(false);

    const userRole = getCurrentUserRole();
    
    // Verify fallback role is viewer
    expect(userRole).toBe(PRODUCTION_FALLBACK_ROLE);
    expect(userRole).toBe('viewer');

    // Check if viewer has warehouse_staff permissions
    const canWrite = hasRoleAccess(userRole, 'warehouse_staff');
    
    // Expect write access to be denied
    expect(canWrite).toBe(false);
  });

  it('should allow warehouse_staff access when demo role selector is allowed and set to admin', () => {
    // Mock the environment to allow demo selector (like development mode)
    vi.spyOn(demoRoleSelectorControl, 'isDemoRoleSelectorAllowed').mockReturnValue(true);

    // Assuming DEFAULT_DEMO_ROLE is 'admin' or has been set to something higher than viewer
    const userRole = getCurrentUserRole(); // typically 'admin' by default
    
    expect(['admin', 'warehouse_manager', 'warehouse_staff']).toContain(userRole);

    const canWrite = hasRoleAccess(userRole, 'warehouse_staff');
    
    // Expect write access to be allowed
    expect(canWrite).toBe(true);
  });
});
