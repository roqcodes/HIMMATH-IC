-- Restore rate group ↔ branch assignments (dropped in inr_aed refactor). Rates-only cron must not touch these rows.
CREATE TABLE IF NOT EXISTS public.ic_rate_group_branches (
    group_id VARCHAR(50) NOT NULL REFERENCES public.ic_rate_groups(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_ic_rate_group_branches_branch
  ON public.ic_rate_group_branches (branch_id);

ALTER TABLE public.ic_rate_group_branches ENABLE ROW LEVEL SECURITY;
