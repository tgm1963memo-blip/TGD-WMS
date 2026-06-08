import { expect, test } from 'vitest';
import fs from 'fs';
import path from 'path';

test('20N Final Friday READY/HOLD Decision Template exists and contains required sections', () => {
    const docPath = path.resolve(__dirname, '../../docs/20N_FINAL_FRIDAY_READY_HOLD_DECISION_TEMPLATE.md');
    const docExists = fs.existsSync(docPath);
    expect(docExists).toBe(true);

    const docContent = fs.readFileSync(docPath, 'utf8');

    // Morning start decision section
    expect(docContent).toContain('Morning Start Decision Section');
    expect(docContent).toContain('Latest commit verified');
    expect(docContent).toContain('Git clean status verified');
    expect(docContent).toContain('`npm test` result');
    expect(docContent).toContain('`npm run build` result');
    expect(docContent).toContain('Environment reachable');
    expect(docContent).toContain('Login verified');
    expect(docContent).toContain('User roles verified');
    expect(docContent).toContain('Master data ready');
    expect(docContent).toContain('Opening stock balance captured');
    expect(docContent).toContain('Report preview/print checked');
    expect(docContent).toContain('Evidence folder ready');
    expect(docContent).toContain('Defect log ready');

    // Decision options
    expect(docContent).toContain('READY TO START FRIDAY TEST RUN');
    expect(docContent).toContain('READY WITH CONDITIONS');
    expect(docContent).toContain('HOLD');
    expect(docContent).toContain('NOT READY');

    // Condition table
    expect(docContent).toContain('Condition Table');
    expect(docContent).toContain('Condition ID');
    expect(docContent).toContain('Description');
    expect(docContent).toContain('Owner');
    expect(docContent).toContain('Required Before Start?');
    expect(docContent).toContain('Workaround');
    expect(docContent).toContain('Due Time');
    expect(docContent).toContain('Status');

    // HOLD triggers
    expect(docContent).toContain('HOLD Triggers');
    expect(docContent).toContain('Test fail');
    expect(docContent).toContain('Build fail');
    expect(docContent).toContain('Git not clean');
    expect(docContent).toContain('Environment unreachable');
    expect(docContent).toContain('Login failure');
    expect(docContent).toContain('Missing master data');
    expect(docContent).toContain('Missing opening balance');
    expect(docContent).toContain('Report preview/print failure');
    expect(docContent).toContain('Stock balance mismatch');
    expect(docContent).toContain('Any Critical defect');
    expect(docContent).toContain('Data corruption risk');
    expect(docContent).toContain('Direct database edit required');

    // End-of-day decision section
    expect(docContent).toContain('End-Of-Day Decision Section');
    expect(docContent).toContain('PASS');
    expect(docContent).toContain('PASS WITH WORKAROUND');
    expect(docContent).toContain('HOLD');
    expect(docContent).toContain('FAIL');

    // End-of-day criteria
    expect(docContent).toContain('End-Of-Day Criteria');
    expect(docContent).toContain('All critical scenarios executed');
    expect(docContent).toContain('Critical defects = 0');
    expect(docContent).toContain('High defects have workaround');
    expect(docContent).toContain('Reports preview/print passed');
    expect(docContent).toContain('Stock balance reconciled');
    expect(docContent).toContain('Evidence captured');
    expect(docContent).toContain('Defect log updated');
    expect(docContent).toContain('Business tester acknowledgment');
    expect(docContent).toContain('IT/system owner acknowledgment');
    expect(docContent).toContain('Controller acknowledgment');

    // Final explicit boundaries
    expect(docContent).toContain('Final Explicit Boundaries');
    expect(docContent).toContain('Friday Test Run is controlled UAT only.');
    expect(docContent).toContain('This document does not authorize Production Go Live.');
    expect(docContent).toContain('This document does not authorize FINAL GO.');
    expect(docContent).toContain('Production remains HOLD.');
    expect(docContent).toContain('No direct database edits are allowed.');
    expect(docContent).toContain('No uncontrolled Production stock movement is allowed.');
    expect(docContent).toContain('Any Critical defect triggers HOLD.');
});
