-- Branch / warehouse desks: assign one or more managers; deals only for their customers.

CREATE TABLE IF NOT EXISTS public.ic_warehouse_managers (
    warehouse_id UUID NOT NULL REFERENCES public.ic_warehouses(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES public.ic_counterparties(id) ON DELETE CASCADE,
    PRIMARY KEY (warehouse_id, manager_id)
);

CREATE INDEX IF NOT EXISTS idx_ic_warehouse_managers_manager
    ON public.ic_warehouse_managers (manager_id);

ALTER TABLE public.ic_warehouse_managers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asic_ic_warehouse_managers_access ON public.ic_warehouse_managers;
CREATE POLICY asic_ic_warehouse_managers_access ON public.ic_warehouse_managers FOR ALL USING (true);
