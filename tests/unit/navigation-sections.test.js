import { describe, expect, it } from 'vitest';
import { navigationGroups } from '../../src/app/navigation.js';
import {
  SIDEBAR_SECTIONS,
  buildSidebarSections,
  findNavigationContext,
  getNavigationItemIcon,
} from '../../src/app/navigationSections.js';

describe('sidebar sections', () => {
  it('maps every navigation group into exactly one section', () => {
    const mapped = SIDEBAR_SECTIONS.flatMap((s) => s.groups);
    expect(new Set(mapped).size).toBe(mapped.length);
    for (const group of navigationGroups) {
      expect(mapped).toContain(group.key);
    }
  });

  it('keeps every visible item, in order, after folding', () => {
    const sections = buildSidebarSections(navigationGroups, 'en');
    const before = navigationGroups.flatMap((g) => g.items.map((i) => i.key)).sort();
    const after = sections.flatMap((s) => s.items.map((i) => i.key)).sort();
    expect(after).toEqual(before);
  });

  it('drops sections whose groups were all filtered out by permissions', () => {
    const onlyPortal = navigationGroups.filter((g) => g.key === 'customer_portal');
    const sections = buildSidebarSections(onlyPortal, 'th');
    expect(sections.map((s) => s.key)).toEqual(['customer']);
    expect(sections[0].label).toBe('พอร์ทัลลูกค้า');
  });

  it('keeps an unmapped group as its own section instead of dropping it', () => {
    const extra = { key: 'brand_new_group', label: 'Brand New', items: [{ key: 'x', label: 'X', path: '/x' }] };
    const sections = buildSidebarSections([...navigationGroups, extra], 'en');
    expect(sections.at(-1)).toMatchObject({ key: 'brand_new_group', label: 'Brand New' });
  });

  it('gives every navigation item an icon', () => {
    for (const item of navigationGroups.flatMap((g) => g.items)) {
      expect(getNavigationItemIcon(item.key)).toBeTruthy();
    }
  });
});

describe('findNavigationContext', () => {
  it('matches an exact path', () => {
    const ctx = findNavigationContext(navigationGroups, '/inventory', 'th');
    expect(ctx.item.key).toBe('stock_balance');
    expect(ctx.sectionLabel).toBe('งานคลัง');
  });

  it('prefers the exact path over a shorter prefix', () => {
    expect(findNavigationContext(navigationGroups, '/inventory/count', 'en').item.key).toBe('stock_count_review');
  });

  it('resolves a detail route to its parent menu item', () => {
    const ctx = findNavigationContext(navigationGroups, '/billing/invoice-drafts/abc-123', 'en');
    expect(ctx.item.key).toBe('billing_invoice_drafts');
    expect(ctx.sectionLabel).toBe('Billing & Reports');
  });

  it('does not treat a sibling path with a shared prefix as a match', () => {
    // /customer is a menu item; /customerX is not under it.
    expect(findNavigationContext(navigationGroups, '/customerX', 'en')).toBeNull();
  });
});
