// tests/unit/receiving-real-stock-posting-design.test.js

describe('Receiving Real Stock Posting RPC Design Document', () => {
  const fs = require('fs');
  const path = require('path');
  const docPath = path.resolve(__dirname, '../../docs/13J-N_RECEIVING_REAL_STOCK_POSTING_DESIGN.md');

  test('design document exists', () => {
    expect(fs.existsSync(docPath)).toBeTruthy();
  });

  const content = fs.readFileSync(docPath, 'utf8');
  const lower = content.toLowerCase();

  // --- Proposed RPC naming ---

  test('doc mentions proposed RPC tgd_rpc_post_receiving_document', () => {
    expect(lower).toContain('tgd_rpc_post_receiving_document');
  });

  test('doc mentions tgd_rpc_confirm_receiving_document as current blocked confirm RPC', () => {
    expect(lower).toContain('tgd_rpc_confirm_receiving_document');
  });

  test('doc does NOT describe tgd_rpc_create_receive_movement as the current receiving confirm RPC', () => {
    // The phrase should not appear as "the current receiving confirm RPC"
    // but may appear as an older dry-run reference.
    // Verify it is NOT described as the "current" confirm path.
    const lines = content.split('\n');
    const confirmLines = lines.filter(l =>
      l.toLowerCase().includes('tgd_rpc_create_receive_movement') &&
      l.toLowerCase().includes('current') &&
      l.toLowerCase().includes('confirm')
    );
    // If tgd_rpc_create_receive_movement appears alongside "current confirm",
    // it must contain a negation or clarification like "must not" or "older".
    confirmLines.forEach(line => {
      const l = line.toLowerCase();
      const hasNegation = l.includes('must not') || l.includes('older') ||
        l.includes('predates') || l.includes('not be used') || l.includes('dry');
      expect(hasNegation).toBeTruthy();
    });
  });

  // --- FK column naming ---

  test('doc uses document_id for receiving_lines FK', () => {
    expect(lower).toContain('document_id');
  });

  test('doc SQL uses WHERE document_id = p_document_id', () => {
    expect(lower).toContain('where document_id = p_document_id');
  });

  test('doc does NOT use receiving_document_id in proposed RPC SQL', () => {
    // receiving_document_id must not appear in the proposed RPC SQL block.
    const sqlBlockMatch = content.match(/```sql[\s\S]*?```/i);
    if (sqlBlockMatch) {
      expect(sqlBlockMatch[0].toLowerCase()).not.toContain('receiving_document_id');
    }
  });

  test('doc does NOT use receiving_document_id in the strategy or RPC sections', () => {
    // receiving_document_id may appear only in migration notes / schema notes
    // referencing 004 migration. It must NOT appear in the proposed RPC or
    // strategy sections (## Proposed, ## Proposed internal stock posting strategy).
    const proposedRpcSection = content.match(/## Proposed new RPC[\s\S]*?(?=\n## )/i);
    const strategySection = content.match(/## Proposed internal stock posting strategy[\s\S]*?(?=\n## )/i);
    if (proposedRpcSection) {
      expect(proposedRpcSection[0].toLowerCase()).not.toContain('receiving_document_id');
    }
    if (strategySection) {
      expect(strategySection[0].toLowerCase()).not.toContain('receiving_document_id');
    }
  });

  // --- Stock balance schema ---

  test('doc mentions current stock_balances.quantity or says schema must be verified', () => {
    const hasQuantity = lower.includes('quantity numeric');
    const hasMustVerify = lower.includes('must verify the actual stock balance columns');
    expect(hasQuantity || hasMustVerify).toBeTruthy();
  });

  test('doc does NOT describe qty_on_hand/qty_allocated/qty_available as current confirmed schema', () => {
    // These column names may appear as "alternative" or "older migration" references,
    // but must NOT appear in the "Current confirmed baseline columns" section.
    const baselineSection = content.match(/current confirmed baseline columns[\s\S]*?(?=\n## |\n> )/i);
    if (baselineSection) {
      const section = baselineSection[0].toLowerCase();
      expect(section).not.toContain('qty_on_hand');
      expect(section).not.toContain('qty_allocated');
      expect(section).not.toContain('qty_available');
    }
  });

  // --- Target location strategy ---

  test('doc mentions Option A add location_id to receiving_lines', () => {
    expect(lower).toContain('option a');
    expect(lower).toContain('location_id');
    expect(lower).toContain('receiving_lines');
  });

  // --- Atomic transaction ---

  test('doc mentions atomic transaction', () => {
    expect(lower).toContain('atomic transaction');
  });

  // --- Status update ordering ---

  test('doc mentions status updates only after all stock movement inserts succeed', () => {
    expect(lower).toContain('status only updates after stock posting succeeds');
  });

  // --- Idempotency / duplicate guard ---

  test('doc mentions duplicate posting guard / idempotency', () => {
    const hasDuplicateGuard = lower.includes('duplicate posting guard');
    const hasIdempotency = lower.includes('idempotent');
    expect(hasDuplicateGuard || hasIdempotency).toBeTruthy();
  });

  test('doc mentions source reference columns for duplicate guard', () => {
    expect(lower).toContain('source_module');
    expect(lower).toContain('source_document_id');
    expect(lower).toContain('source_line_id');
  });

  // --- Access control ---

  test('doc mentions admin role', () => {
    expect(lower).toContain('admin');
  });

  test('doc mentions warehouse_manager role', () => {
    expect(lower).toContain('warehouse_manager');
  });

  // --- Security ---

  test('doc mentions customer isolation', () => {
    expect(lower).toContain('customer isolation');
  });

  test('doc mentions no direct frontend writes', () => {
    expect(lower).toContain('no direct frontend writes');
  });

  test('doc mentions production locked', () => {
    expect(lower).toContain('production locked');
  });

  // --- Negative assertions ---

  test('doc does not claim migration is applied', () => {
    expect(lower).not.toContain('migration is applied');
  });

  test('doc does not enable ReceivingCreatePage', () => {
    expect(lower).not.toContain('receivingcreatepage');
  });

  test('receivingService.js remains RPC-only and Receiving UI locked', () => {
    const receivingServicePath = path.resolve(__dirname, '../../src/services/receivingService.js');
    if (fs.existsSync(receivingServicePath)) {
      const serviceContent = fs.readFileSync(receivingServicePath, 'utf8');
      expect(serviceContent).not.toMatch(/\.insert\s*\(/);
      expect(serviceContent).not.toMatch(/\.update\s*\(/);
      expect(serviceContent).not.toMatch(/\.delete\s*\(/);
      expect(serviceContent).not.toMatch(/\.upsert\s*\(/);
    }
    // Also verify the design doc does not reference receivingService.js as modified
    expect(lower).not.toContain('receivingservice.js');
  });
});
