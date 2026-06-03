-- 025_tgd_wms_outbound_picking_foundation.sql
-- Outbound / Picking foundation tables (draft)
-- Production is strictly not touched in this sprint.
-- Production is strictly not touched.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Outbound document header
CREATE TABLE tgd_outbound_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_no text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','RESERVED','PICKED','CONFIRMED','CANCELLED')),
  customer_id uuid NOT NULL,
  source_module text,
  source_document_id uuid,
  source_document_no text,
  requested_ship_date date,
  created_by uuid,
  posted_by uuid,
  posted_at timestamptz,
  cancelled_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbound_documents_document_no ON tgd_outbound_documents(document_no);
CREATE INDEX idx_outbound_documents_customer_id ON tgd_outbound_documents(customer_id);

-- Outbound line items
CREATE TABLE tgd_outbound_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id uuid NOT NULL REFERENCES tgd_outbound_documents(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  lot_id uuid,
  requested_quantity numeric NOT NULL CHECK (requested_quantity > 0),
  requested_weight numeric NOT NULL DEFAULT 0 CHECK (requested_weight >= 0),
  picked_quantity numeric NOT NULL DEFAULT 0 CHECK (picked_quantity >= 0),
  picked_weight numeric NOT NULL DEFAULT 0 CHECK (picked_weight >= 0),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESERVED','PICKED','SHORT','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbound_lines_document_id ON tgd_outbound_lines(document_id);
CREATE INDEX idx_outbound_lines_product_id ON tgd_outbound_lines(product_id);
CREATE INDEX idx_outbound_lines_lot_id ON tgd_outbound_lines(lot_id);

-- Outbound reservations (stock reserved for picking)
CREATE TABLE tgd_outbound_reservations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  outbound_document_id uuid NOT NULL REFERENCES tgd_outbound_documents(id) ON DELETE CASCADE,
  outbound_line_id uuid NOT NULL REFERENCES tgd_outbound_lines(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  product_id uuid NOT NULL,
  lot_id uuid,
  location_id uuid NOT NULL,
  reserved_quantity numeric NOT NULL CHECK (reserved_quantity > 0),
  reserved_weight numeric NOT NULL DEFAULT 0 CHECK (reserved_weight >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RELEASED','CONSUMED','CANCELLED')),
  created_by uuid,
  released_by uuid,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbound_reservations_document_id ON tgd_outbound_reservations(outbound_document_id);
CREATE INDEX idx_outbound_reservations_line_id ON tgd_outbound_reservations(outbound_line_id);
CREATE INDEX idx_outbound_reservations_product_id ON tgd_outbound_reservations(product_id);
CREATE INDEX idx_outbound_reservations_location_id ON tgd_outbound_reservations(location_id);

-- Guard: only one ACTIVE reservation per line per location
CREATE UNIQUE INDEX uq_active_reservation_per_line_location ON tgd_outbound_reservations(
  outbound_line_id,
  location_id
) WHERE status = 'ACTIVE';
