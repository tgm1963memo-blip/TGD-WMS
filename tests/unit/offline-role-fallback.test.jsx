import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOfflineRole, isNetworkFailure, loadOfflineRole, saveOfflineRole } from '../../src/security/offlineRoleCache.js';
import { UserRoleProvider, useUserRole } from '../../src/features/auth/UserRoleProvider.jsx';
import { clearAuthenticatedUserRole } from '../../src/security/currentUserRole.js';
import { getCurrentUserProfile } from '../../src/services/userProfileService.js';
import { refreshRoleAreaPermissionCache } from '../../src/services/roleAreaPermissionCacheService.js';
import { resolveCustomRoleBaseRole, setCustomRoleBaseRoles } from '../../src/security/customRoleBaseRoles.js';

let sessionUser = { id: 'user-1' };

vi.mock('../../src/features/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ session: sessionUser ? { user: sessionUser } : null, loading: false }),
}));
vi.mock('../../src/services/userProfileService.js', () => ({ getCurrentUserProfile: vi.fn() }));
vi.mock('../../src/services/roleAreaPermissionCacheService.js', () => ({
  refreshRoleAreaPermissionCache: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../src/services/customerCustomRoleService.js', () => ({ getCustomerCustomRole: vi.fn() }));

function RoleProbe() {
  const { role, ready } = useUserRole();
  return <div data-testid="role">{ready ? role : 'loading'}</div>;
}

function setOnline(value) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);
}

async function renderedRole() {
  render(<UserRoleProvider><RoleProbe /></UserRoleProvider>);
  await waitFor(() => expect(screen.getByTestId('role').textContent).not.toBe('loading'));
  return screen.getByTestId('role').textContent;
}

const networkError = { message: 'TypeError: Failed to fetch' };

describe('offline role cache', () => {
  beforeEach(() => clearOfflineRole());

  it('never hands one user\'s role to another', () => {
    saveOfflineRole('user-1', { role: 'warehouse_staff' });
    expect(loadOfflineRole('user-1').role).toBe('warehouse_staff');
    expect(loadOfflineRole('user-2')).toBeNull();
  });

  it('tells a network failure from a server refusal', () => {
    setOnline(true);
    expect(isNetworkFailure(networkError)).toBe(true);
    expect(isNetworkFailure({ message: 'Load failed' })).toBe(true);
    expect(isNetworkFailure({ message: 'permission denied for table tgd_user_profiles' })).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('UserRoleProvider without signal', () => {
  beforeEach(() => {
    sessionUser = { id: 'user-1' };
    clearOfflineRole();
    clearAuthenticatedUserRole();
    getCurrentUserProfile.mockReset();
    refreshRoleAreaPermissionCache.mockReset();
    refreshRoleAreaPermissionCache.mockResolvedValue({ ok: true });
    setCustomRoleBaseRoles([]);
  });

  afterEach(() => vi.restoreAllMocks());

  it('reopens offline with the last confirmed role and skips the request', async () => {
    setOnline(false);
    saveOfflineRole('user-1', { role: 'warehouse_staff' });

    expect(await renderedRole()).toBe('warehouse_staff');
    expect(getCurrentUserProfile).not.toHaveBeenCalled();
  });

  it('uses the cache when "online" Wi-Fi has no real internet', async () => {
    setOnline(true);
    saveOfflineRole('user-1', { role: 'warehouse_staff' });
    getCurrentUserProfile.mockResolvedValue({ data: null, error: networkError });

    expect(await renderedRole()).toBe('warehouse_staff');
  });

  it('stays viewer offline when nothing is cached for this user', async () => {
    setOnline(false);
    saveOfflineRole('someone-else', { role: 'admin' });
    getCurrentUserProfile.mockResolvedValue({ data: null, error: networkError });

    expect(await renderedRole()).toBe('viewer');
  });

  it('ignores the cache when the server refuses', async () => {
    setOnline(true);
    saveOfflineRole('user-1', { role: 'admin' });
    getCurrentUserProfile.mockResolvedValue({ data: null, error: { message: 'JWT expired' } });

    expect(await renderedRole()).toBe('viewer');
  });

  it('trusts the server over the cache and updates the cache', async () => {
    setOnline(true);
    saveOfflineRole('user-1', { role: 'admin' });
    getCurrentUserProfile.mockResolvedValue({ data: { role: 'warehouse_staff', is_active: true, status: 'active' }, error: null });

    expect(await renderedRole()).toBe('warehouse_staff');
    expect(loadOfflineRole('user-1').role).toBe('warehouse_staff');
  });

  it('replaces a cached role with the server\'s answer when signal returns, without a loading screen', async () => {
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    saveOfflineRole('user-1', { role: 'warehouse_manager' });
    expect(await renderedRole()).toBe('warehouse_manager');

    const seen = [];
    const observer = new MutationObserver(() => seen.push(screen.getByTestId('role').textContent));
    observer.observe(screen.getByTestId('role'), { childList: true, characterData: true, subtree: true });

    onLine.mockReturnValue(true);
    getCurrentUserProfile.mockResolvedValue({ data: { role: 'warehouse_staff', is_active: true, status: 'active' }, error: null });
    await act(async () => { window.dispatchEvent(new Event('online')); });

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('warehouse_staff'));
    observer.disconnect();
    expect(seen).not.toContain('loading');
  });

  it('keeps a custom role\'s base role working offline', async () => {
    setOnline(false);
    saveOfflineRole('user-1', { role: 'cold_room_lead', baseRole: 'warehouse_staff' });

    expect(await renderedRole()).toBe('cold_room_lead');
    expect(resolveCustomRoleBaseRole('cold_room_lead')).toBe('warehouse_staff');
  });

  it('keeps the cached role when the role list fails to load and the role looks unknown', async () => {
    setOnline(true);
    saveOfflineRole('user-1', { role: 'cold_room_lead', baseRole: 'warehouse_staff' });
    refreshRoleAreaPermissionCache.mockResolvedValue({ ok: false, error: new Error('timeout') });
    getCurrentUserProfile.mockResolvedValue({ data: { role: 'cold_room_lead', is_active: true, status: 'active' }, error: null });

    expect(await renderedRole()).toBe('cold_room_lead');
    expect(loadOfflineRole('user-1').role).toBe('cold_room_lead');
  });

  it('does not wait out a hanging request when a cached role exists', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setOnline(true);
    saveOfflineRole('user-1', { role: 'warehouse_staff' });
    getCurrentUserProfile.mockReturnValue(new Promise(() => {}));

    render(<UserRoleProvider><RoleProbe /></UserRoleProvider>);
    await act(async () => { vi.advanceTimersByTime(6500); });

    expect(screen.getByTestId('role').textContent).toBe('warehouse_staff');
    vi.useRealTimers();
  });

  it('keeps the cached role when a recheck gets an empty answer', async () => {
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    saveOfflineRole('user-1', { role: 'warehouse_staff' });
    expect(await renderedRole()).toBe('warehouse_staff');

    onLine.mockReturnValue(true);
    getCurrentUserProfile.mockResolvedValue({ data: null, error: null });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(getCurrentUserProfile).toHaveBeenCalled());

    expect(screen.getByTestId('role').textContent).toBe('warehouse_staff');
  });

  it('rechecks a viewer fallback once the server can be reached', async () => {
    setOnline(true);
    getCurrentUserProfile.mockResolvedValueOnce({ data: null, error: networkError });
    expect(await renderedRole()).toBe('viewer');

    getCurrentUserProfile.mockResolvedValue({ data: { role: 'warehouse_staff', is_active: true, status: 'active' }, error: null });
    await act(async () => { window.dispatchEvent(new Event('online')); });

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('warehouse_staff'));
  });

  it('forgets the cached role on sign-out', async () => {
    setOnline(true);
    saveOfflineRole('user-1', { role: 'warehouse_staff' });
    sessionUser = null;

    await renderedRole();

    expect(loadOfflineRole('user-1')).toBeNull();
  });
});
