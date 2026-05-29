import React from 'react';
import { render, screen } from '@testing-library/react';
import AppErrorBoundary from '../../src/components/common/AppErrorBoundary.jsx';
import fs from 'fs';
import path from 'path';

function BrokenComponent() {
  throw new Error('Sprint 8D render failure');
}

describe('AppErrorBoundary', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('renders children normally', () => {
    render(
      <AppErrorBoundary>
        <p>Safe child content</p>
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Safe child content')).toBeInTheDocument();
  });

  test('catches render error and shows safe fallback', () => {
    render(
      <AppErrorBoundary language="en">
        <BrokenComponent />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/Error reference:/)).toBeInTheDocument();
  });

  test('fallback does not expose stack trace or raw error message', () => {
    render(
      <AppErrorBoundary language="en">
        <BrokenComponent />
      </AppErrorBoundary>,
    );

    expect(screen.queryByText(/Sprint 8D render failure/)).toBeNull();
    expect(screen.queryByText(/at BrokenComponent/)).toBeNull();
  });

  test('retry button exists', () => {
    render(
      <AppErrorBoundary language="en">
        <BrokenComponent />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  test('does not call remote, database, or browser storage APIs', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/common/AppErrorBoundary.jsx'),
      'utf8',
    );

    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/axios/);
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/supabase/i);
    expect(source).not.toMatch(/localStorage/);
    expect(source).not.toMatch(/sessionStorage/);
    expect(source).not.toMatch(/writeFile/);
  });
});
