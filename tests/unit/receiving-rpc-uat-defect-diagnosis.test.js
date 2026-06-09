import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22G Receiving RPC UAT Defect Diagnosis', () => {
  it('should identify false positive RPC keyword in ReceivingListPage.jsx', () => {
    const filePath = path.resolve(__dirname, '../../src/features/operations/receiving/ReceivingListPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Verify the static warning panel text exists
    expect(content).toContain('Confirm/Post is available on draft page via RPC.');
    expect(content).toContain('className="warning-panel"');
  });

  it('should list receiving RPCs used by service but not on list page load', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/receivingService.js');
    const serviceContent = fs.readFileSync(servicePath, 'utf-8');
    
    expect(serviceContent).toContain('tgd_rpc_create_receiving_draft');
    expect(serviceContent).toContain('tgd_rpc_post_receiving_document');
    expect(serviceContent).toContain('tgd_rpc_add_receiving_line');
    
    // List page just queries table
    expect(serviceContent).toContain(".from('tgd_receiving_documents')");
  });
});
