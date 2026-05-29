// tests/unit/database-schema-foundation.test.js

import { expect, test, describe } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import path from 'path'

const projectRoot = path.resolve(__dirname, '../../')
const migrationPath = path.join(projectRoot, 'database', 'migrations', '001_tgd_wms_schema_foundation.sql')
const docsPath = path.join(projectRoot, 'docs', 'database')

describe('Database Schema Foundation', () => {
  test('migration file exists', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  test('required tables exist in migration', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    const requiredTables = [
      'tgd_customers',
      'tgd_products',
      'tgd_lots',
      'tgd_warehouses',
      'tgd_zones',
      'tgd_locations',
      'tgd_pallets',
      'tgd_stock_balances',
      'tgd_stock_movements',
      'tgd_receiving_documents',
      'tgd_receiving_lines',
      'tgd_putaway_tasks',
      'tgd_transfer_documents',
      'tgd_transfer_lines',
      'tgd_adjustment_documents',
      'tgd_adjustment_lines',
      'tgd_stock_count_sessions',
      'tgd_stock_count_lines',
      'tgd_withdrawal_requests',
      'tgd_withdrawal_request_lines',
      'tgd_allocation_records',
      'tgd_picking_tasks',
      'tgd_dispatch_documents',
      'tgd_dispatch_lines',
      'tgd_operation_charges',
      'tgd_monthly_storage_snapshots',
      'tgd_accounting_charge_staging',
      'tgd_user_profiles',
      'tgd_audit_logs',
    ]
    for (const tbl of requiredTables) {
      expect(sql).toMatch(new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${tbl}\\b`, 'i'))
    }
  })

  test('forbidden naming patterns are absent', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    const forbidden = ['sales_order', 'sales_orders', 'so_', 'outbound_orders', 'invoice', 'invoice_lines', 'sales fulfillment']
    for (const word of forbidden) {
      expect(sql).not.toMatch(new RegExp(word, 'i'))
    }
  })

  test('required documentation files exist and contain headings', () => {
    const foundationDoc = path.join(docsPath, 'tgd-wms-database-schema-foundation.md')
    const erMapDoc = path.join(docsPath, 'tgd-wms-entity-relationship-map.md')
    expect(existsSync(foundationDoc)).toBe(true)
    expect(existsSync(erMapDoc)).toBe(true)
    const foundationContent = readFileSync(foundationDoc, 'utf8')
    const erContent = readFileSync(erMapDoc, 'utf8')
    // check some key headings exist
    expect(foundationContent).toMatch(/## Purpose/i)
    expect(foundationContent).toMatch(/## Database Principles/i)
    expect(erContent).toMatch(/## Overview/i)
    expect(erContent).toMatch(/## Table List/i)
  })
})
