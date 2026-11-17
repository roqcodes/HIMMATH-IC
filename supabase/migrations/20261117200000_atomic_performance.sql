-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Atomic performance — subsecond OLTP indexes + idempotency guards
-- 2026-11-17  Himmath IC Transfer
--
-- Goals:
--   1. Enforce DB-level idempotency for active/pending vouchers (partial unique)
--   2. Speed up void lookups (branch + ref type + ref id + status)
--   3. Speed up WAC pool queries (warehouse time-ordered scans)
--   4. Speed up metal purchase → sale repair queries
--   5. Speed up account lookup by source (branch sync paths)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Partial unique index on ic_fund_vouchers (AED book)
--      Enforces: only one active/pending voucher per (branch, ref_type, ref_id).
--      voidVoucherByReference sets status='void' so voided rows are excluded.
--      This turns concurrent duplicate-posting into a 23505 unique violation
--      which postVoucherInTx already handles gracefully.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ic_fund_vouchers_active_ref
  ON ic_fund_vouchers (branch_id, reference_type, reference_id)
  WHERE status IN ('active', 'pending');

-- ── 2. Partial unique index on inr_fund_vouchers (INR book)
--      Only active vouchers are deduplicated; pending is not used in INR path.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inr_fund_vouchers_active_ref
  ON inr_fund_vouchers (branch_id, reference_type, reference_id)
  WHERE status = 'active';

-- ── 3. Covering index for fast void lookups — AED book
--      voidVoucherByReference does:
--        SELECT id FROM ic_fund_vouchers
--        WHERE branch_id=$1 AND reference_type=$2 AND reference_id=$3
--          AND status IN ('active','pending')
--      This index covers the WHERE and returns id from index alone (index-only scan).
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_ref_status
  ON ic_fund_vouchers (branch_id, reference_type, reference_id, status)
  WHERE status IN ('active', 'pending', 'void');

-- ── 4. Covering index for fast void lookups — INR book
CREATE INDEX IF NOT EXISTS idx_inr_fund_vouchers_ref_status
  ON inr_fund_vouchers (branch_id, reference_type, reference_id, status)
  WHERE status IN ('active', 'void');

-- ── 5. WAC pool: time-ordered warehouse purchase scan
--      loadWarehouseInventoryEvents does:
--        SELECT ... FROM ic_purchases
--        WHERE warehouse_id=$1 AND created_at<=$2 AND settlement_mode<>'metal'
--        ORDER BY created_at ASC, id ASC
CREATE INDEX IF NOT EXISTS idx_ic_purchases_warehouse_created
  ON ic_purchases (warehouse_id, created_at, id)
  WHERE COALESCE(settlement_mode, 'cash') <> 'metal';

-- ── 6. WAC pool: time-ordered warehouse completed-sales scan
--      loadWarehouseInventoryEvents does:
--        SELECT ... FROM ic_sales
--        WHERE warehouse_id=$1 AND order_status='completed'
--          AND settlement_mode<>'metal' AND id<>$2
--          AND status_updated_at<=$3
--        ORDER BY completed_at ASC, created_at ASC, id ASC
CREATE INDEX IF NOT EXISTS idx_ic_sales_warehouse_completed
  ON ic_sales (warehouse_id, order_status, COALESCE(status_updated_at, created_at), created_at, id)
  WHERE order_status = 'completed';

-- ── 7. Metal purchase → linked sale repair
--      repairCompletedMetalSalesForPurchase does:
--        SELECT * FROM ic_sales
--        WHERE metal_purchase_id=$1 AND settlement_mode='metal'
--          AND order_status='completed'
CREATE INDEX IF NOT EXISTS idx_ic_sales_metal_purchase
  ON ic_sales (metal_purchase_id, settlement_mode, order_status)
  WHERE settlement_mode = 'metal' AND order_status = 'completed';

-- ── 8. AED account source lookup (ensureLinkedAccount hot path)
--      SELECT id FROM ic_fund_accounts
--      WHERE branch_id=$1 AND source_type=$2 AND source_id=$3
CREATE INDEX IF NOT EXISTS idx_ic_fund_accounts_source
  ON ic_fund_accounts (branch_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

-- ── 9. INR account source lookup (ensureInrSystemAccount / ensureInrLinkedAccount)
--      SELECT id FROM inr_fund_accounts
--      WHERE branch_id=$1 AND source_id=$2
CREATE INDEX IF NOT EXISTS idx_inr_fund_accounts_source
  ON inr_fund_accounts (branch_id, source_id)
  WHERE source_id IS NOT NULL;

-- ── 10. ic_fund_voucher_counters PK already covers single-row upsert. No extra index needed.
--       inr_fund_voucher_counters same.

-- ── 11. Partial index for INR metal deal voucher void
--       voidInrMetalDealVouchers does:
--         WHERE branch_id=$1 AND status='active'
--           AND (reference_type=ANY($2) AND reference_id=$3
--                OR reference_id LIKE $4)
CREATE INDEX IF NOT EXISTS idx_inr_fund_vouchers_metal_deal
  ON inr_fund_vouchers (branch_id, reference_id)
  WHERE status = 'active';

-- ── 12. Advisory lock hash index note (pg_advisory_xact_lock uses hashtext(text))
--       No index needed — this is a lock, not a table scan.
--       Documented here for ops reference:
--         ic_purchase_sync:{purchaseId}  → serialises purchase journal repost
--         ic_sale_sync:{saleId}          → serialises sale journal repost

-- ── Schema sync: add columns if missing (idempotent guards) ──────────────────

-- ic_fund_vouchers: voided_at and voided_by_name may already exist; guard with IF NOT EXISTS.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='ic_fund_vouchers' AND column_name='voided_at'
  ) THEN
    ALTER TABLE ic_fund_vouchers ADD COLUMN voided_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='ic_fund_vouchers' AND column_name='voided_by_name'
  ) THEN
    ALTER TABLE ic_fund_vouchers ADD COLUMN voided_by_name TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='inr_fund_vouchers' AND column_name='voided_at'
  ) THEN
    ALTER TABLE inr_fund_vouchers ADD COLUMN voided_at TIMESTAMPTZ;
  END IF;
END $$;
