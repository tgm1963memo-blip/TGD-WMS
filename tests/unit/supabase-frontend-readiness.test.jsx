// tests/unit/supabase-frontend-readiness.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthReadinessPage } from '../../src/features/admin/AuthReadinessPage.jsx';

// Mock the translation function to prevent missing key warnings
vi.mock('../../src/i18n/translationCatalog.js', () => ({
  getTranslation: (key) => key,
}));

// Mock Supabase readiness service to provide controlled data
vi.mock('../../src/services/supabaseConnectionReadinessService.js', () => ({
  summarizeSupabaseReadiness: () => ({
    ready: false,
    safe: false,
    urlConfigured: false,
    anonKeyConfigured: false,
    serviceRoleExposed: false,
    clientInitialized: false,
    schemaValid: false,
    connectionValid: false,
    issues: [],
    nextActions: [],
  }),
}));

describe('Supabase Frontend Readiness Panel', () => {
  it('does not render any masked secret values or URLs and shows correct safe status', () => {
    render(<AuthReadinessPage />);

    // Headings and section checking
    expect(screen.getByText('Supabase Frontend Readiness')).toBeInTheDocument();
    expect(screen.getByText('Frontend connection readiness')).toBeInTheDocument();

    // Check actual safe values being rendered
    expect(screen.getByText('Secret display:')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();

    expect(screen.getByText('Production readiness:')).toBeInTheDocument();
    // Use getAllByText for "Not ready" as it might appear multiple times
    const notReadyElements = screen.getAllByText('Not ready');
    expect(notReadyElements.length).toBeGreaterThan(0);

    expect(screen.getByText('Live write:')).toBeInTheDocument();
    expect(screen.getByText('Transaction write:')).toBeInTheDocument();
    const disabledElements = screen.getAllByText('Disabled');
    expect(disabledElements.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText('service_role exposed:')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();

    // Negative assertions for secrets
    const forbidden = [/supabase\.co/i, /eyJ/i, /service_role/i, /maskedUrl/i, /maskedAnonKey/i, /password/i, /connection string/i];
    forbidden.forEach((re) => {
      // Allow exact safe matches for 'service_role' and 'password' in static messages
      if (re.source === 'service_role' || re.source === 'password') {
        const found = screen.queryAllByText(re);
        found.forEach(element => {
          const text = element.textContent;
          const allowed = 
            /service_role exposed/i.test(text) || 
            text === 'NO_SERVICE_ROLE_EXPOSURE' ||
            text.includes('must not expose service role, private, token, password, or database keys');
          expect(allowed).toBe(true);
        });
      } else {
        expect(screen.queryAllByText(re)).toHaveLength(0);
      }
    });
  });
});
