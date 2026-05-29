import React, { useEffect, useState } from 'react';
import { AccountingChargeReviewSummary } from '../../components/reports/AccountingChargeReviewSummary.jsx';
import { AccountingChargeReviewDraftTable } from '../../components/reports/AccountingChargeReviewDraftTable.jsx';
import { AccountingChargeReviewIssuePanel } from '../../components/reports/AccountingChargeReviewIssuePanel.jsx';
import { getAccountingChargeStagingPreview } from '../../services/accountingChargeStagingPreviewService.js';
import {
  createAccountingChargeReviewDraft,
  classifyAccountingChargeReviewRows,
  attachAccountingReviewNotes,
  summarizeAccountingChargeReviewDraft,
  validateAccountingChargeReviewDraft,
  groupReviewDraftIssues,
  markRowsForReviewOnly,
  createReviewOnlyHandoffSnapshot,
} from '../../services/accountingChargeHandoffReviewService.js';

export const AccountingChargeHandoffReviewPage = () => {
  const [previewData, setPreviewData] = useState(null);
  const [reviewDraft, setReviewDraft] = useState(null);
  const [notes, setNotes] = useState({}); // key: rowId, value: note string

  // Load staging preview data once
  useEffect(() => {
    const data = getAccountingChargeStagingPreview();
    setPreviewData(data);
    // Create initial review draft from staging data
    const draft = createAccountingChargeReviewDraft(data);
    setReviewDraft(draft);
  }, []);

  // Example of handling note changes (ephemeral only)
  const handleNoteChange = (rowId, note) => {
    setNotes((prev) => ({ ...prev, [rowId]: note }));
    const updatedDraft = attachAccountingReviewNotes(reviewDraft, { rowId, note });
    setReviewDraft(updatedDraft);
  };

  if (!previewData || !reviewDraft) {
    return <div>Loading review draft…</div>;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Accounting Charge Handoff Review (Draft)</h1>
      <AccountingChargeReviewSummary summary={summarizeAccountingChargeReviewDraft(reviewDraft)} />
      <AccountingChargeReviewIssuePanel issues={groupReviewDraftIssues(reviewDraft)} />
      <AccountingChargeReviewDraftTable
        draft={reviewDraft}
        notes={notes}
        onNoteChange={handleNoteChange}
      />
    </div>
  );
};


