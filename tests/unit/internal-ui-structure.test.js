import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 5C internal operation UI structure', () => {
  it('does not register standalone transfer, adjustment, or stock-count routes', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    [
      '/operations/transfer',
      '/operations/adjustment',
      '/stock-count',
    ].forEach((removedRoute) => {
      expect(routesSource).not.toContain(removedRoute);
    });
  });

  it('keeps active routes focused on customer deposit driven operations', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    [
      '/operations/receiving',
      '/operations/withdrawal-requests',
      '/inventory',
      '/handheld',
    ].forEach((routePath) => {
      expect(routesSource).toContain(routePath);
    });
  });

  it('does not create database, legacy, or Express sync artifacts', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'database/migrations/017_internal_ui.sql'))).toBe(false);
  });
});
