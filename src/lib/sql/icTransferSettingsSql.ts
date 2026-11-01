export const SQL_ENSURE_IC_TRANSFER_SETTINGS = `
CREATE TABLE IF NOT EXISTS ic_transfer_settings (
  id VARCHAR(20) PRIMARY KEY DEFAULT 'global',
  sales_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_rate_reset_enabled BOOLEAN NOT NULL DEFAULT false,
  warehouse_fulfillment_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255)
);

ALTER TABLE ic_transfer_settings
  ADD COLUMN IF NOT EXISTS warehouse_fulfillment_enabled BOOLEAN NOT NULL DEFAULT false;

INSERT INTO ic_transfer_settings (id, sales_enabled, auto_rate_reset_enabled, warehouse_fulfillment_enabled)
VALUES ('global', true, false, false)
ON CONFLICT (id) DO NOTHING;
`;
