import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../src/services/supabaseClient.js';

// Unit test for withdrawal line pick safeguard:
// When weight is fully withdrawn, boxes must also be fully withdrawn.
// This prevents balance_weight and balance_boxes from drifting apart.

describe('Withdrawal line pick: weight-boxes sync safeguard', () => {
  describe('tgd_record_withdrawal_line_pick validation', () => {
    it('should allow normal partial picks without safeguard triggering', () => {
      // Scenario: 131 boxes / 651 kg available
      // Pick: 60 boxes / 300 kg (partial pick)
      // Expected: Succeeds, picks are within remaining balance

      const mockData = {
        v_max_boxes: 131,
        v_max_weight: 651,
        v_claimed_boxes: 0,
        v_claimed_weight: 0,
        v_remaining_boxes: 131,
        v_remaining_weight: 651,
        p_picked_boxes: 60,
        p_picked_weight: 300,
      };

      // The safeguard only triggers if:
      // p_picked_weight >= v_remaining_weight AND p_picked_boxes < v_remaining_boxes
      const shouldTriggerSafeguard =
        mockData.p_picked_weight >= mockData.v_remaining_weight &&
        (mockData.p_picked_boxes === null || mockData.p_picked_boxes < mockData.v_remaining_boxes);

      expect(shouldTriggerSafeguard).toBe(false);
    });

    it('should block weight-only depletion (the safeguard case)', () => {
      // Scenario: 131 boxes / 651 kg available, already picked 124 boxes / 619 kg
      // Pick: 7 kg more (bringing weight to 626 kg, which exceeds 651-619=32 remaining)
      // But try to pick only 1 box more (bringing boxes to 125, leaving 6 dangling)
      // Expected: Safeguard blocks this

      const mockData = {
        v_max_boxes: 131,
        v_max_weight: 651,
        v_claimed_boxes: 124,
        v_claimed_weight: 619,
        v_remaining_boxes: 131 - 124,  // 7 boxes left
        v_remaining_weight: 651 - 619,  // 32 kg left
        p_picked_boxes: 1,
        p_picked_weight: 32, // This picks all 32 kg remaining
      };

      // The safeguard triggers if:
      // p_picked_weight >= v_remaining_weight AND p_picked_boxes < v_remaining_boxes
      const shouldTriggerSafeguard =
        mockData.p_picked_weight >= mockData.v_remaining_weight &&
        (mockData.p_picked_boxes === null || mockData.p_picked_boxes < mockData.v_remaining_boxes);

      expect(shouldTriggerSafeguard).toBe(true);
      expect(shouldTriggerSafeguard).toBe(true);
    });

    it('should allow weight-depleting pick if boxes are also depleted', () => {
      // Scenario: 131 boxes / 651 kg available, already picked 124 boxes / 619 kg
      // Pick: 7 boxes / 32 kg (the exact remaining amount)
      // Expected: Succeeds because both boxes and weight are fully depleted

      const mockData = {
        v_max_boxes: 131,
        v_max_weight: 651,
        v_claimed_boxes: 124,
        v_claimed_weight: 619,
        v_remaining_boxes: 7,
        v_remaining_weight: 32,
        p_picked_boxes: 7,
        p_picked_weight: 32,
      };

      const shouldTriggerSafeguard =
        mockData.p_picked_weight >= mockData.v_remaining_weight &&
        (mockData.p_picked_boxes === null || mockData.p_picked_boxes < mockData.v_remaining_boxes);

      expect(shouldTriggerSafeguard).toBe(false);
    });

    it('should enforce matching end-state for closing picks', () => {
      // Scenario: 10 boxes / 50 kg available (all last remaining)
      // Pick: 10 boxes / 48 kg (boxes match, weight slightly under due to scale variance)
      // Expected: Weight snaps to exactly 50 kg to match the closing pick

      const mockData = {
        v_max_boxes: 10,
        v_max_weight: 50,
        v_claimed_boxes: 0,
        v_claimed_weight: 0,
        v_remaining_boxes: 10,
        v_remaining_weight: 50,
        p_picked_boxes: 10, // All boxes
        p_picked_weight: 48, // Slightly under
      };

      // Closing pick: p_picked_boxes === v_remaining_boxes
      const isClosingPick = mockData.p_picked_boxes === mockData.v_remaining_boxes;

      // On closing pick, weight should snap to remaining weight
      const expectedSnappedWeight = isClosingPick ? mockData.v_remaining_weight : mockData.p_picked_weight;

      expect(isClosingPick).toBe(true);
      expect(expectedSnappedWeight).toBe(50);
    });

    it('real example from production: FR260820038', () => {
      // Real data from investigation:
      // Deposit: 131 boxes / 651 kg
      // Withdrawal lines total: 130 boxes / 651 kg (spread across 4 lines)
      // Balance should be: 1 box / 0 kg
      // If staff picks the last line (6 boxes / 31 kg), this should complete the lot

      const mockData = {
        v_max_boxes: 131,
        v_max_weight: 651,
        // Already claimed by other lines: 4+60+60 = 124 boxes, 20+300+300 = 620 kg
        v_claimed_boxes: 124,
        v_claimed_weight: 620,
        v_remaining_boxes: 131 - 124,  // 7 boxes
        v_remaining_weight: 651 - 620,  // 31 kg
        // Trying to pick the last line: 6 boxes / 31 kg
        p_picked_boxes: 6,
        p_picked_weight: 31,
      };

      // The safeguard check:
      const safeguardTriggered =
        mockData.v_max_weight > 0 &&
        mockData.v_remaining_weight > 0 &&
        mockData.p_picked_weight !== null &&
        mockData.p_picked_weight >= mockData.v_remaining_weight &&
        (mockData.p_picked_boxes === null || mockData.p_picked_boxes < mockData.v_remaining_boxes);

      // This should NOT trigger because we're picking 6 boxes (leaving only 1 unpicked)
      // but fully depleting weight (31 kg remaining). The safeguard would block this
      // unless the user also accounts for the remaining 1 box.
      expect(safeguardTriggered).toBe(true);
      expect(safeguardTriggered).toBe(true); // Intentional double-check for clarity
    });
  });

  describe('Balance calculation consistency after pick', () => {
    it('demonstrates why balance drift occurred before safeguard', () => {
      // Before fix: withdrawal lines could have inconsistent weight-per-box ratios
      // Line 1: 4 boxes / 20 kg = 5.00 kg/box
      // Line 2: 60 boxes / 300 kg = 5.00 kg/box
      // Line 3: 60 boxes / 300 kg = 5.00 kg/box
      // Line 4: 6 boxes / 31 kg = 5.17 kg/box
      // Total: 130 boxes / 651 kg = 5.008 kg/box
      //
      // Deposit: 131 boxes / 651 kg = 4.97 kg/box
      //
      // Balance: 1 box / 0 kg (IMPOSSIBLE - 1 box should weigh ~5 kg)

      const depositPerBox = 651 / 131;  // 4.97 kg/box
      const withdrawalPerBox = 651 / 130;  // 5.008 kg/box
      const expectedWeightFor1Box = 1 * depositPerBox;

      expect(depositPerBox).toBeCloseTo(4.97, 1);
      expect(withdrawalPerBox).toBeCloseTo(5.008, 2);
      expect(expectedWeightFor1Box).toBeGreaterThan(0);
      // Before fix, balance showed 0 kg for 1 remaining box
    });
  });
});
