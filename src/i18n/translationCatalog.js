// src/i18n/translationCatalog.js

/**
 * Translation Catalog for Thai (default) and English support.
 * Pure functions only – no side effects.
 */

export const SUPPORTED_LANGUAGES = ['th', 'en'];
export const DEFAULT_LANGUAGE = 'th';

// Core translation entries – keys map to an object with language values.
export const TRANSLATION_CATALOG = {
  // Common actions
  preview: { th: 'แสดงตัวอย่าง', en: 'Preview' },
  review: { th: 'ตรวจสอบ', en: 'Review' },
  inspect: { th: 'ตรวจสอบอย่างละเอียด', en: 'Inspect' },
  validate: { th: 'ยืนยัน', en: 'Validate' },
  view_mapping: { th: 'ดูการแมป', en: 'View Mapping' },
  open_report: { th: 'เปิดรายงาน', en: 'Open Report' },
  back: { th: 'ย้อนกลับ', en: 'Back' },
  search: { th: 'ค้นหา', en: 'Search' },
  filter: { th: 'ตัวกรอง', en: 'Filter' },
  clear_filter: { th: 'ล้างตัวกรอง', en: 'Clear Filter' },

  unexpected_error: { th: 'ข้อผิดพลาดที่ไม่คาดคิด', en: 'Unexpected error' },
  something_went_wrong: { th: 'ระบบเกิดข้อผิดพลาด', en: 'Something went wrong' },
  try_again: { th: 'ลองอีกครั้ง', en: 'Try again' },
  error_reference: { th: 'รหัสอ้างอิงข้อผิดพลาด', en: 'Error reference' },
  contact_admin_if_persists: { th: 'หากปัญหายังคงอยู่ กรุณาติดต่อผู้ดูแลระบบ', en: 'Contact an administrator if the problem continues' },
  config_ready: { th: 'การตั้งค่าพร้อมใช้งาน', en: 'Config ready' },
  config_warning: { th: 'คำเตือนการตั้งค่า', en: 'Config warning' },
  config_missing_required_key: { th: 'ขาดค่าการตั้งค่าที่จำเป็น', en: 'Missing required config key' },
  deployment_readiness: { th: 'ความพร้อมก่อนนำขึ้นใช้งาน', en: 'Deployment readiness' },
  production_checklist: { th: 'รายการตรวจสอบระบบจริง', en: 'Production checklist' },

  // Report names
  inventory_dashboard: { th: 'แดชบอร์ดสินค้าคงคลัง', en: 'Inventory Dashboard' },
  movement_ledger_report: { th: 'รายงานบัญชีการเคลื่อนไหว', en: 'Movement Ledger Report' },
  customer_storage_balance_report: { th: 'รายงานยอดคงเหลือของลูกค้า', en: 'Customer Storage Balance Report' },
  storage_aging_report: { th: 'รายงานอายุการจัดเก็บ', en: 'Storage Aging Report' },
  warehouse_operation_performance_report: { th: 'รายงานประสิทธิภาพการทำงานของคลัง', en: 'Warehouse Operation Performance Report' },
  monthly_storage_billing_summary: { th: 'สรุปบิลค่าจอดรายเดือน', en: 'Monthly Storage Billing Summary' },
  accounting_charge_staging_preview: { th: 'สรุปค่าใช้จ่าย (ตัวอย่าง)', en: 'Accounting Charge Staging Preview' },
  accounting_charge_handoff_review_draft: { th: 'ร่างการส่งต่อค่าบัญชี', en: 'Accounting Charge Handoff Review Draft' },

  // Accounting charge terms
  accounting_charge_summary: { th: 'สรุปค่าใช้จ่ายบัญชี', en: 'Accounting Charge Summary' },
  canonical_payload: { th: 'ข้อมูลต้นฉบับ', en: 'Canonical Payload' },
  bplus_draft_mapping: { th: 'แมป Draft Bplus', en: 'Bplus Draft Mapping' },
  handoff_review_draft: { th: 'ร่างการส่งต่อตรวจสอบ', en: 'Handoff Review Draft' },
  review_only: { th: 'ตรวจสอบเท่านั้น', en: 'Review Only' },
  no_send_no_export_notice: { th: 'ไม่มีการส่งหรือส่งออก', en: 'No Send / No Export Notice' },

  // Warehouse terms
  receiving: { th: 'รับสินค้า', en: 'Receiving' },
  putaway: { th: 'จัดเก็บ', en: 'Putaway' },
  transfer: { th: 'โอนสินค้า', en: 'Transfer' },
  adjustment: { th: 'ปรับปรุงสต็อก', en: 'Adjustment' },
  stock_count: { th: 'นับสต็อก', en: 'Stock Count' },
  withdrawal: { th: 'ถอนสินค้า', en: 'Withdrawal' },
  allocation: { th: 'จัดสรร', en: 'Allocation' },
  picking: { th: 'คัดเลือก', en: 'Picking' },
  dispatch: { th: 'จัดส่ง', en: 'Dispatch' },

  // Status terms
  ready_for_review: { th: 'พร้อมตรวจสอบ', en: 'Ready for Review' },
  requires_review: { th: 'ต้องตรวจสอบ', en: 'Requires Review' },
  blocked: { th: 'บล็อก', en: 'Blocked' },
  warning: { th: 'คำเตือน', en: 'Warning' },
  info: { th: 'ข้อมูล', en: 'Info' },
  missing_customer_code: { th: 'ไม่มีรหัสลูกค้า', en: 'Missing Customer Code' },
  missing_billing_period: { th: 'ไม่มีรอบบิล', en: 'Missing Billing Period' },
  missing_service_code: { th: 'ไม่มีรหัสบริการ', en: 'Missing Service Code' },
  missing_quantity_or_weight: { th: 'ไม่มีจำนวนหรือ น้ำหนัก', en: 'Missing Quantity or Weight' },
  permission_denied: { th: 'ไม่มีสิทธิ์เข้าถึง', en: 'Permission denied' },
  insufficient_permission: { th: 'สิทธิ์ไม่เพียงพอ', en: 'Insufficient permission' },
  contact_admin: { th: 'ติดต่อผู้ดูแลระบบ', en: 'Contact admin' },
  language: { th: 'ภาษา', en: 'Language' },
  thai: { th: 'ไทย', en: 'Thai' },
  english: { th: 'อังกฤษ', en: 'English' },
  current_language: { th: 'ภาษาปัจจุบัน', en: 'Current language' },
  access_denied: { th: 'การเข้าถึงถูกปฏิเสธ', en: 'Access denied' },
  route_permission_required: { th: 'ต้องการสิทธิ์การเข้าถึงเส้นทาง', en: 'Route permission required' },
  user_role: { th: 'บทบาทผู้ใช้', en: 'User role' },
  // Alias keys for test compatibility
  accounting_charge_handoff_review: { th: 'ร่างการส่งต่อค่าบัญชี', en: 'Accounting Charge Handoff Review Draft' },
  movement_ledger: { th: 'รายงานบัญชีการเคลื่อนไหว', en: 'Movement Ledger Report' },
  customer_storage_balance: { th: 'รายงานยอดคงเหลือของลูกค้า', en: 'Customer Storage Balance Report' },
  storage_aging: { th: 'รายงานอายุการจัดเก็บ', en: 'Storage Aging Report' },
  warehouse_operation_performance: { th: 'รายงานประสิทธิภาพการทำงานของคลัง', en: 'Warehouse Operation Performance Report' },
  // New keys for Sprint 8C
  reports: { th: 'รายงาน', en: 'Reports' },
  accounting_reports: { th: 'รายงานบัญชี', en: 'Accounting Reports' },
  warehouse_reports: { th: 'รายงานคลังสินค้า', en: 'Warehouse Reports' },
  permission_control: { th: 'ควบคุมสิทธิ', en: 'Permission Control' },
  role_demo: { th: 'ตัวอย่างบทบาท', en: 'Role Demo' },
  current_role: { th: 'บทบาทปัจจุบัน', en: 'Current Role' },
  frontend_only_demo: { th: 'ตัวอย่างเฉพาะ Front‑end', en: 'Frontend‑only Demo' },
  route_hidden_by_permission: { th: 'ซ่อนตามสิทธิ', en: 'Route hidden by permission' },
  accounting_charge_handoff_review_draft: { th: 'ร่างการส่งต่อค่าบัญชี (Draft)', en: 'Accounting Charge Handoff Review Draft' },
  document_branding: { th: 'การตั้งค่าแบรนด์เอกสาร', en: 'Document Branding' },
  document_branding_preview: { th: 'ตัวอย่างแบรนด์เอกสาร', en: 'Document Branding Preview' },
  company_logo: { th: 'โลโก้บริษัท', en: 'Company Logo' },
  document_header: { th: 'หัวเอกสาร', en: 'Document Header' },
  document_footer: { th: 'ท้ายเอกสาร', en: 'Document Footer' },
  prepared_by: { th: 'จัดทำโดย', en: 'Prepared by' },
  approved_by: { th: 'อนุมัติโดย', en: 'Approved by' },
  document_no: { th: 'เลขที่เอกสาร', en: 'Document No.' },
  document_date: { th: 'วันที่เอกสาร', en: 'Document Date' },
  preview_only: { th: 'แสดงตัวอย่างเท่านั้น', en: 'Preview only' },
  no_logo_configured: { th: 'ยังไม่ได้ตั้งค่าโลโก้', en: 'No logo configured' },
};

Object.assign(TRANSLATION_CATALOG, {
  auth_readiness: { th: 'ความพร้อมระบบยืนยันตัวตน', en: 'Auth Readiness' },
  production_authentication: { th: 'ระบบยืนยันตัวตนสำหรับ Production', en: 'Production Authentication' },
  role_assignment: { th: 'การกำหนดบทบาทผู้ใช้', en: 'Role Assignment' },
  demo_role_selector: { th: 'ตัวเลือกบทบาทสาธิต', en: 'Demo Role Selector' },
  viewer_fallback: { th: 'ค่าเริ่มต้นเป็นผู้ดูรายงาน', en: 'Viewer Fallback' },
  admin_role_review: { th: 'ตรวจสอบบทบาทผู้ดูแลระบบ', en: 'Admin Role Review' },
  warehouse_role_review: { th: 'ตรวจสอบบทบาทคลังสินค้า', en: 'Warehouse Role Review' },
  accounting_role_review: { th: 'ตรวจสอบบทบาทบัญชี', en: 'Accounting Role Review' },
  auth_provider_required: { th: 'ต้องกำหนดผู้ให้บริการยืนยันตัวตน', en: 'Auth Provider Required' },
  no_service_role_exposure: { th: 'ห้ามเปิดเผย service role key', en: 'No Service Role Exposure' },
  read_only_review: { th: 'ตรวจสอบแบบอ่านอย่างเดียว', en: 'Read-only Review' },
  production_limitation: { th: 'ข้อจำกัดสำหรับ Production', en: 'Production Limitation' },
});

Object.assign(TRANSLATION_CATALOG, {
  "auth_readiness.title": { th: 'ความพร้อมระบบยืนยันตัวตน', en: 'Auth Readiness' },
  "auth_readiness.description": { th: 'ตรวจสอบการกำหนดบทบาทและการยืนยันตัวตนสำหรับ Production', en: 'Verify role assignment and authentication for Production' },
});

Object.assign(TRANSLATION_CATALOG, {
  document_branding_settings: { th: 'การตั้งค่าแบรนด์เอกสาร', en: 'Document Branding Settings' },
  edit_document_branding: { th: 'แก้ไขการตั้งค่าเอกสาร', en: 'Edit Document Branding' },
  logo_reference: { th: 'อ้างอิงโลโก้', en: 'Logo Reference' },
  company_information: { th: 'ข้อมูลบริษัท', en: 'Company Information' },
  contact_information: { th: 'ข้อมูลติดต่อ', en: 'Contact Information' },
  footer_information: { th: 'ข้อมูลท้ายเอกสาร', en: 'Footer Information' },
  preview_document_branding: { th: 'แสดงตัวอย่างแบรนด์เอกสาร', en: 'Preview Document Branding' },
  reset_draft: { th: 'ล้างแบบร่าง', en: 'Reset Draft' },
  update_preview: { th: 'อัปเดตตัวอย่าง', en: 'Update Preview' },
  not_saved_to_database: { th: 'ยังไม่บันทึกลงฐานข้อมูล', en: 'Not Saved To Database' },
  logo_upload_not_enabled: { th: 'ยังไม่เปิดใช้การอัปโหลดโลโก้', en: 'Logo Upload Not Enabled' },
  invalid_logo_reference: { th: 'ข้อมูลอ้างอิงโลโก้ไม่ถูกต้อง', en: 'Invalid Logo Reference' },
  unsafe_logo_reference: { th: 'ข้อมูลอ้างอิงโลโก้ไม่ปลอดภัย', en: 'Unsafe Logo Reference' },
  required_company_name: { th: 'ต้องระบุชื่อบริษัทภาษาไทย', en: 'Required Company Name' },
  branding_validation_warning: { th: 'คำเตือนการตรวจสอบแบรนด์เอกสาร', en: 'Branding Validation Warning' },
});

Object.assign(TRANSLATION_CATALOG, {
  app_name: { th: 'TGD WMS', en: 'TGD WMS' },
  dashboard: { th: 'แดชบอร์ด', en: 'Dashboard' },
  reports: { th: 'รายงาน', en: 'Reports' },
  admin: { th: 'ผู้ดูแลระบบ', en: 'Admin' },
  warehouse: { th: 'คลังสินค้า', en: 'Warehouse' },
  master_data: { th: 'ข้อมูลหลัก', en: 'Master Data' },
  receiving: { th: 'รับสินค้าเข้า', en: 'Receiving' },
  putaway: { th: 'นำสินค้าเข้าที่จัดเก็บ', en: 'Putaway' },
  transfer: { th: 'โอนย้ายภายในคลัง', en: 'Transfer' },
  adjustment: { th: 'ปรับปรุงสินค้าคงคลัง', en: 'Adjustment' },
  stock_count: { th: 'ตรวจนับสินค้า', en: 'Stock Count' },
  customer_withdrawal: { th: 'การเบิกสินค้าโดยลูกค้า', en: 'Customer Withdrawal' },
  allocation: { th: 'จัดสรรสินค้า', en: 'Allocation' },
  picking: { th: 'หยิบสินค้า', en: 'Picking' },
  dispatch_goods_issue: { th: 'จ่ายสินค้าออก', en: 'Dispatch / Goods Issue' },
  inventory_dashboard: { th: 'แดชบอร์ดสินค้าคงคลัง', en: 'Inventory Dashboard' },
  movement_ledger: { th: 'รายงานการเคลื่อนไหวสินค้า', en: 'Movement Ledger' },
  movement_ledger_report: { th: 'รายงานการเคลื่อนไหวสินค้าของลูกค้า', en: 'Customer Stock Movement Ledger' },
  customer_storage_balance: { th: 'รายงานยอดคงเหลือการจัดเก็บของลูกค้า', en: 'Customer Storage Balance' },
  customer_storage_balance_report: { th: 'รายงานยอดคงเหลือการจัดเก็บของลูกค้า', en: 'Customer Storage Balance Report' },
  storage_aging: { th: 'รายงานอายุการจัดเก็บ / Lot / วันคิดค่าบริการ', en: 'Storage Aging' },
  storage_aging_report: { th: 'รายงานอายุการจัดเก็บ / Lot / Expiry / วันคิดค่าบริการ', en: 'Storage Aging / Lot / Expiry / Chargeable Days Report' },
  warehouse_operation_performance_report: { th: 'รายงานประสิทธิภาพการปฏิบัติงานคลัง', en: 'Warehouse Operation Performance Report' },
  monthly_storage_billing_summary: { th: 'รายงานสรุปรายเดือนแบบตัวอย่างสำหรับให้บัญชีตรวจสอบก่อนจัดทำค่าบริการจัดเก็บ', en: 'Monthly Storage Billing Summary' },
  accounting_charge_review: { th: 'การตรวจสอบข้อมูลค่าบริการส่งต่อบัญชี', en: 'Accounting Charge Review' },
  accounting_charge_staging_preview: { th: 'ตัวอย่างข้อมูลค่าบริการสำหรับตรวจสอบ', en: 'Accounting Charge Staging Preview' },
  accounting_charge_handoff_review_draft: { th: 'ร่างตรวจสอบการส่งต่อข้อมูลค่าบริการให้บัญชีแบบอ่านอย่างเดียว', en: 'Accounting Charge Handoff Review Draft' },
  document_branding: { th: 'แบรนด์เอกสาร', en: 'Document Branding' },
  document_branding_settings: { th: 'ตั้งค่าแบรนด์เอกสาร', en: 'Document Branding Settings' },
  document_branding_preview: { th: 'ตัวอย่างแบรนด์เอกสาร', en: 'Document Branding Preview' },
  auth_readiness: { th: 'ความพร้อมระบบยืนยันตัวตน', en: 'Auth Readiness' },
  production_authentication: { th: 'ระบบยืนยันตัวตนสำหรับ Production', en: 'Production Authentication' },
  save: { th: 'บันทึก', en: 'Save' },
  cancel: { th: 'ยกเลิก', en: 'Cancel' },
  search: { th: 'ค้นหา', en: 'Search' },
  filter: { th: 'ตัวกรอง', en: 'Filter' },
  reset: { th: 'รีเซ็ต', en: 'Reset' },
  clear: { th: 'ล้าง', en: 'Clear' },
  view: { th: 'ดู', en: 'View' },
  edit: { th: 'แก้ไข', en: 'Edit' },
  delete: { th: 'ลบ', en: 'Delete' },
  back: { th: 'ย้อนกลับ', en: 'Back' },
  next: { th: 'ถัดไป', en: 'Next' },
  previous: { th: 'ก่อนหน้า', en: 'Previous' },
  loading: { th: 'กำลังโหลด', en: 'Loading' },
  no_data: { th: 'ไม่มีข้อมูล', en: 'No data' },
  status: { th: 'สถานะ', en: 'Status' },
  date: { th: 'วันที่', en: 'Date' },
  customer: { th: 'ลูกค้า', en: 'Customer' },
  product: { th: 'สินค้า', en: 'Product' },
  lot: { th: 'ล็อต', en: 'Lot' },
  pallet: { th: 'พาเลท', en: 'Pallet' },
  location: { th: 'ตำแหน่งจัดเก็บ', en: 'Location' },
  quantity: { th: 'จำนวน', en: 'Quantity' },
  weight: { th: 'น้ำหนัก', en: 'Weight' },
  created_at: { th: 'วันที่สร้าง', en: 'Created at' },
  updated_at: { th: 'วันที่แก้ไขล่าสุด', en: 'Updated at' },
  action: { th: 'การทำงาน', en: 'Action' },
  warning: { th: 'คำเตือน', en: 'Warning' },
  error: { th: 'ข้อผิดพลาด', en: 'Error' },
  success: { th: 'สำเร็จ', en: 'Success' },
  preview_only: { th: 'แสดงตัวอย่างเท่านั้น', en: 'Preview only' },
  not_saved_to_database: { th: 'ยังไม่บันทึกลงฐานข้อมูล', en: 'Not saved to database' },
  current_language: { th: 'ภาษาปัจจุบัน', en: 'Current language' },
  thai: { th: 'ไทย', en: 'Thai' },
  english: { th: 'English', en: 'English' },
  open_report: { th: 'เปิดรายงาน', en: 'Open report' },
  report_page_description: { th: 'รายงานแบบอ่านอย่างเดียวสำหรับการปฏิบัติงานคลังเย็น', en: 'Read-only cold storage operation reports.' },
});

Object.assign(TRANSLATION_CATALOG, {
  movement_ledger_report_description: { th: 'รายงานอ่านอย่างเดียวสำหรับติดตามการเคลื่อนไหวสินค้าของลูกค้าและเตรียมข้อมูลค่าบริการจัดเก็บ', en: 'Read-only customer stock movement report for cold storage operations and billing preparation.' },
  customer_storage_balance_report_description: { th: 'ยอดคงเหลือสินค้าของลูกค้าแยกตามสินค้า ล็อต พาเลท คลัง และตำแหน่งจัดเก็บ', en: 'Current customer-owned inventory balances by product, lot, pallet, warehouse, and location.' },
  storage_aging_report_description: { th: 'ตรวจสอบอายุการจัดเก็บ วันหมดอายุ และข้อมูลประกอบการคิดค่าบริการของสินค้าฝักเก็บ', en: 'Read-only lot aging, expiry monitoring, and chargeable days preparation for stored customer-owned goods.' },
  warehouse_operation_performance_report_description: { th: 'สรุปภาระงานคลังและกิจกรรมค่าบริการปฏิบัติการสำหรับคลังเย็น', en: 'Read-only warehouse workload and operation charge activity preview for cold storage operations.' },
  monthly_storage_billing_summary_description: { th: 'ข้อมูลสรุปรายเดือนแบบตัวอย่างสำหรับให้บัญชีตรวจสอบก่อนจัดทำค่าบริการจัดเก็บ', en: 'Preview-only monthly storage billing support for accounting review.' },
  accounting_charge_staging_preview_description: { th: 'พื้นที่ตัวอย่างสำหรับตรวจสอบรายการค่าบริการและร่างการแมปไปยัง Bplus', en: 'Read-only staging area to review canonical charges and Bplus draft mappings.' },
  accounting_charge_handoff_review_draft_description: { th: 'ร่างตรวจสอบการส่งต่อข้อมูลค่าบริการให้บัญชีแบบอ่านอย่างเดียว ไม่มีการส่งออก สร้างเอกสาร หรือบันทึกบัญชี', en: 'Review-only accounting charge handoff draft for Bplus preview. No send, export, invoice, or posting actions.' },
});

Object.assign(TRANSLATION_CATALOG, {
  main_menu: { th: 'เมนูหลัก', en: 'Main Menu' },
  warehouse_operations: { th: 'งานคลังสินค้า', en: 'Warehouse Operations' },
  administration: { th: 'ผู้ดูแลระบบ', en: 'Administration' },
  system_status: { th: 'สถานะระบบ', en: 'System status' },
  demo_mode: { th: 'โหมดทดสอบ', en: 'Demo Mode' },
  demo_only: { th: 'สำหรับทดสอบเท่านั้น', en: 'Demo only' },
  open_module: { th: 'เปิดโมดูล', en: 'Open module' },
  quick_access: { th: 'ทางลัด', en: 'Quick Access' },
  production_readiness: { th: 'ความพร้อมใช้งานจริง', en: 'Production Readiness' },
  system_ready: { th: 'ระบบพร้อมใช้งาน', en: 'System ready' },
  requires_review: { th: 'ต้องตรวจสอบ', en: 'Requires review' },
  preview_mode: { th: 'โหมดตัวอย่าง', en: 'Preview mode' },
  view_details: { th: 'ดูรายละเอียด', en: 'View details' },
});

Object.assign(TRANSLATION_CATALOG, {
  warehouse_operations: { th: 'งานคลังสินค้า', en: 'Warehouse Operations' },
  receiving: { th: 'รับสินค้าเข้า', en: 'Receiving' },
  receiving_list: { th: 'รายการรับสินค้าเข้า', en: 'Receiving List' },
  receiving_detail: { th: 'รายละเอียดการรับสินค้าเข้า', en: 'Receiving Detail' },
  create_receiving: { th: 'สร้างเอกสารรับสินค้าเข้า', en: 'Create Receiving' },
  putaway: { th: 'นำสินค้าเข้าที่จัดเก็บ', en: 'Putaway' },
  putaway_list: { th: 'รายการนำสินค้าเข้าที่จัดเก็บ', en: 'Putaway List' },
  putaway_task: { th: 'งานนำสินค้าเข้าที่จัดเก็บ', en: 'Putaway Task' },
  transfer: { th: 'โอนย้ายภายในคลัง', en: 'Transfer' },
  transfer_list: { th: 'รายการโอนย้ายภายในคลัง', en: 'Transfer List' },
  create_transfer: { th: 'สร้างเอกสารโอนย้าย', en: 'Create Transfer' },
  adjustment: { th: 'ปรับปรุงสินค้าคงคลัง', en: 'Adjustment' },
  adjustment_list: { th: 'รายการปรับปรุงสินค้าคงคลัง', en: 'Adjustment List' },
  create_adjustment: { th: 'สร้างเอกสารปรับปรุง', en: 'Create Adjustment' },
  stock_count: { th: 'ตรวจนับสินค้า', en: 'Stock Count' },
  stock_count_list: { th: 'รายการตรวจนับสินค้า', en: 'Stock Count List' },
  create_stock_count: { th: 'สร้างเอกสารตรวจนับ', en: 'Create Stock Count' },
  customer_withdrawal: { th: 'การเบิกสินค้าโดยลูกค้า', en: 'Customer Withdrawal' },
  withdrawal_request: { th: 'คำขอเบิกสินค้าโดยลูกค้า', en: 'Customer Withdrawal Request' },
  withdrawal_list: { th: 'รายการคำขอเบิกสินค้า', en: 'Withdrawal List' },
  allocation: { th: 'จัดสรรสินค้า', en: 'Allocation' },
  allocation_list: { th: 'รายการจัดสรรสินค้า', en: 'Allocation List' },
  picking: { th: 'หยิบสินค้า', en: 'Picking' },
  picking_list: { th: 'รายการหยิบสินค้า', en: 'Picking List' },
  picking_task: { th: 'งานหยิบสินค้า', en: 'Picking Task' },
  dispatch_goods_issue: { th: 'จ่ายสินค้าออก', en: 'Dispatch / Goods Issue' },
  dispatch_list: { th: 'รายการจ่ายสินค้าออก', en: 'Dispatch List' },
  outbound_documents: { th: 'รายการจ่ายสินค้าออก', en: 'Outbound Documents' },
  outbound_draft: { th: 'ทดลองสร้างเอกสารจ่ายออก', en: 'Outbound Draft' },
  goods_issue: { th: 'จ่ายสินค้าออก', en: 'Goods Issue' },
  scan_barcode: { th: 'สแกนบาร์โค้ด', en: 'Scan Barcode' },
  scan_pallet: { th: 'สแกนพาเลท', en: 'Scan Pallet' },
  scan_location: { th: 'สแกนตำแหน่งจัดเก็บ', en: 'Scan Location' },
  scan_lot: { th: 'สแกนล็อต', en: 'Scan Lot' },
  source_location: { th: 'ตำแหน่งต้นทาง', en: 'Source Location' },
  destination_location: { th: 'ตำแหน่งปลายทาง', en: 'Destination Location' },
  requested_qty: { th: 'จำนวนที่ขอเบิก', en: 'Requested Qty' },
  picked_qty: { th: 'จำนวนที่หยิบแล้ว', en: 'Picked Qty' },
  dispatched_qty: { th: 'จำนวนที่จ่ายออกแล้ว', en: 'Dispatched Qty' },
  available_qty: { th: 'จำนวนพร้อมใช้', en: 'Available Qty' },
  reserved_qty: { th: 'จำนวนที่จองไว้', en: 'Reserved Qty' },
  pending: { th: 'รอดำเนินการ', en: 'Pending' },
  completed: { th: 'เสร็จสิ้น', en: 'Completed' },
  cancelled: { th: 'ยกเลิก', en: 'Cancelled' },
  draft: { th: 'แบบร่าง', en: 'Draft' },
  in_progress: { th: 'กำลังดำเนินการ', en: 'In Progress' },
  review_required: { th: 'ต้องตรวจสอบ', en: 'Review Required' },
  operation_status: { th: 'สถานะงาน', en: 'Operation Status' },
  created_by: { th: 'สร้างโดย', en: 'Created By' },
  assigned_to: { th: 'มอบหมายให้', en: 'Assigned To' },
  updated_by: { th: 'แก้ไขโดย', en: 'Updated By' },
  operation_date: { th: 'วันที่ปฏิบัติงาน', en: 'Operation Date' },
  reference_no: { th: 'เลขอ้างอิง', en: 'Reference No' },
  document_no: { th: 'เลขที่เอกสาร', en: 'Document No' },
  customer_owned_inventory: { th: 'สินค้าคงคลังของลูกค้า', en: 'Customer-owned Inventory' },
  no_operation_data: { th: 'ไม่พบข้อมูลงานคลังสินค้า', en: 'No operation data' },
  select_customer: { th: 'เลือกลูกค้า', en: 'Select Customer' },
  select_product: { th: 'เลือกสินค้า', en: 'Select Product' },
  confirm_action: { th: 'ยืนยันการทำรายการ', en: 'Confirm Action' },
  operation_note: { th: 'หมายเหตุการปฏิบัติงาน', en: 'Operation Note' },
  create_draft: { th: 'สร้างแบบร่าง', en: 'Create draft' },
  refresh: { th: 'รีเฟรช', en: 'Refresh' },
  type: { th: 'ประเภท', en: 'Type' },
  warehouse: { th: 'คลังสินค้า', en: 'Warehouse' },
  date_from: { th: 'วันที่เริ่มต้น', en: 'Date From' },
  date_to: { th: 'วันที่สิ้นสุด', en: 'Date To' },
  document_lines: { th: 'รายการสินค้า', en: 'Lines' },
  draft_lines: { th: 'รายการแบบร่าง', en: 'Draft Lines' },
  add_draft_line: { th: 'เพิ่มรายการแบบร่าง', en: 'Add draft line' },
});

Object.assign(TRANSLATION_CATALOG, {
  tgm_cold_storage_wms: { th: 'TGM Cold Storage WMS', en: 'TGM Cold Storage WMS' },
  thai_german_meat_product: { th: 'บริษัท ไทย-เยอรมัน มีท โปรดักท์ จำกัด', en: 'Thai-German Meat Product Co., Ltd.' },
  premium_dashboard: { th: 'แดชบอร์ดองค์กรสำหรับคลังเย็น', en: 'Premium dashboard' },
  refresh_data: { th: 'รีเฟรชข้อมูล', en: 'Refresh data' },
  view_details: { th: 'ดูรายละเอียด', en: 'View details' },
  system_status: { th: 'สถานะระบบ', en: 'System status' },
});

Object.assign(TRANSLATION_CATALOG, {
  real_user_role_verification: { th: 'ตรวจสอบสิทธิ์ผู้ใช้จริง', en: 'Real User Role Verification' },
  user_role_assignment: { th: 'การกำหนดบทบาทผู้ใช้', en: 'User Role Assignment' },
  role_assignment_checklist: { th: 'รายการตรวจสอบบทบาทผู้ใช้', en: 'Role Assignment Checklist' },
  admin_role_review_required: { th: 'ต้องตรวจสอบบทบาทผู้ดูแลระบบ', en: 'Admin Role Review Required' },
  missing_role_fallback_viewer: { th: 'บทบาทที่หายไปต้องกลับเป็นผู้ดูข้อมูล', en: 'Missing Role Falls Back To Viewer' },
  unknown_role_fallback_viewer: { th: 'บทบาทที่ไม่รู้จักต้องกลับเป็นผู้ดูข้อมูล', en: 'Unknown Role Falls Back To Viewer' },
  no_admin_default: { th: 'ผู้ดูแลระบบต้องไม่เป็นค่าเริ่มต้น', en: 'No Admin Default' },
  production_role_ready: { th: 'บทบาทผู้ใช้พร้อมสำหรับ Production', en: 'Production Role Ready' },
  production_role_not_ready: { th: 'บทบาทผู้ใช้ยังไม่พร้อมสำหรับ Production', en: 'Production Role Not Ready' },
  role_assignment_evidence_required: { th: 'ต้องมีหลักฐานการกำหนดบทบาท', en: 'Role Assignment Evidence Required' },
  reviewed_by_admin: { th: 'ตรวจสอบโดยผู้ดูแลระบบแล้ว', en: 'Reviewed By Admin' },
  verification_status: { th: 'สถานะการตรวจสอบ', en: 'Verification Status' },
});

Object.assign(TRANSLATION_CATALOG, {
  "supabase_readiness.title": { th: 'สถานะการเชื่อมต่อ Supabase', en: 'Supabase Connection Readiness' },
  "supabase_readiness.description": { th: 'ตรวจสอบการตั้งค่า Supabase สำหรับการเชื่อมต่อ Frontend', en: 'Check Supabase configuration for frontend connection' },
  "supabase_readiness.url_configured": { th: 'URL ตั้งค่าแล้ว', en: 'URL Configured' },
  "supabase_readiness.anon_key_configured": { th: 'Anon Key ตั้งค่าแล้ว', en: 'Anon Key Configured' },
  "supabase_readiness.service_role_not_exposed": { th: 'ไม่มีการเปิดเผย service_role', en: 'Service role not exposed' },
  "supabase_readiness.environment_ready": { th: 'สภาพแวดล้อมพร้อม', en: 'Environment Ready' },
  "supabase_readiness.environment_not_ready": { th: 'สภาพแวดล้อมไม่พร้อม', en: 'Environment Not Ready' },
  "supabase_readiness.next_action": { th: 'การกระทำต่อไป', en: 'Next Action' },
  "supabase_readiness.ready_for_schema": { th: 'พร้อมสำหรับ Schema', en: 'Ready for Schema' },
  "supabase_readiness.missing_env": { th: 'ค่าตัวแปรสภาพแวดล้อมหาย', en: 'Missing environment variable' },
  "supabase_readiness.invalid_url": { th: 'URL ไม่ถูกต้อง', en: 'Invalid URL' },
  "supabase_readiness.service_role_detected": { th: 'พบ service_role key', en: 'Service role detected' },
  "supabase_readiness.masked_url": { th: 'URL ที่แสดง', en: 'Masked URL' },
  "supabase_readiness.masked_anon_key": { th: 'Anon Key ที่แสดง', en: 'Masked Anon Key' },
});

/** Retrieve a translation for a given key and language. */
export function getTranslation(key, language) {
  const entry = TRANSLATION_CATALOG[key];
  if (!entry) return '';
  if (entry[language]) return entry[language];
  // fallback to default language
  return entry[DEFAULT_LANGUAGE] || '';
}

/** List all translation keys. */
export function listTranslationKeys() {
  return Object.keys(TRANSLATION_CATALOG);
}

/** Validate the catalog – ensure each key has non‑empty values for all supported languages. */
export function validateTranslationCatalog(catalog) {
  const errors = [];
  const keys = Object.keys(catalog);
  for (const key of keys) {
    const entry = catalog[key];
    for (const lang of SUPPORTED_LANGUAGES) {
      if (!entry[lang] || typeof entry[lang] !== 'string' || entry[lang].trim() === '') {
        errors.push(`Missing or empty translation for key "${key}" language "${lang}"`);
      }
    }
  }
  return errors;
}
