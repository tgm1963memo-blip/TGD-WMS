import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { from: vi.fn(), rpc: rpcMock },
}));

const {
  upsertCustomerCustomRole,
  deleteCustomerCustomRole,
  listCustomerTeamUsers,
  assignCustomerUserCustomRole,
} = await import('../../src/services/customerCustomRoleService.js');

describe('customerCustomRoleService RPC wiring', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { id: 'role-1' }, error: null });
  });

  it('upsertCustomerCustomRole forwards role name and menu keys', async () => {
    await upsertCustomerCustomRole({ roleName: 'คลังสินค้า', allowedMenuKeys: ['customer_stock_balance', 'customer_movement_ledger'], isActive: true });
    expect(rpcMock).toHaveBeenCalledWith('tgd_upsert_customer_custom_role', {
      p_role_id: null,
      p_role_name: 'คลังสินค้า',
      p_allowed_menu_keys: ['customer_stock_balance', 'customer_movement_ledger'],
      p_is_active: true,
    });
  });

  it('upsertCustomerCustomRole includes roleId when editing', async () => {
    await upsertCustomerCustomRole({ roleId: 'role-1', roleName: 'บัญชี', allowedMenuKeys: [], isActive: false });
    expect(rpcMock).toHaveBeenCalledWith('tgd_upsert_customer_custom_role', expect.objectContaining({
      p_role_id: 'role-1',
      p_is_active: false,
    }));
  });

  it('deleteCustomerCustomRole forwards the role id', async () => {
    await deleteCustomerCustomRole('role-1');
    expect(rpcMock).toHaveBeenCalledWith('tgd_delete_customer_custom_role', { p_role_id: 'role-1' });
  });

  it('listCustomerTeamUsers calls the RPC with no params', async () => {
    await listCustomerTeamUsers();
    expect(rpcMock).toHaveBeenCalledWith('tgd_list_customer_team_users');
  });

  it('assignCustomerUserCustomRole forwards both ids', async () => {
    await assignCustomerUserCustomRole('user-1', 'role-1');
    expect(rpcMock).toHaveBeenCalledWith('tgd_assign_customer_user_custom_role', {
      p_user_profile_id: 'user-1',
      p_custom_role_id: 'role-1',
    });
  });

  it('assignCustomerUserCustomRole defaults to null (revoke) when no role given', async () => {
    await assignCustomerUserCustomRole('user-1');
    expect(rpcMock).toHaveBeenCalledWith('tgd_assign_customer_user_custom_role', {
      p_user_profile_id: 'user-1',
      p_custom_role_id: null,
    });
  });
});
