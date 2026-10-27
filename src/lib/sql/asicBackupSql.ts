/** Idempotent Himmath IC backup history table. */

export const SQL_ENSURE_ASIC_BACKUPS_TABLE = `
CREATE TABLE IF NOT EXISTS public.asic_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(128),
    created_by_email VARCHAR(255),
    destination VARCHAR(20) NOT NULL CHECK (destination IN ('local', 'db')),
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('full', 'custom')),
    date_filter VARCHAR(40) NOT NULL DEFAULT 'all-time',
    start_date DATE,
    end_date DATE,
    tables TEXT[] NOT NULL DEFAULT '{}',
    row_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    filename VARCHAR(255) NOT NULL,
    payload JSONB,
    notes TEXT
)
`;

export const SQL_ENSURE_ASIC_BACKUPS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_asic_backups_created ON public.asic_backups (created_at DESC)
`;
