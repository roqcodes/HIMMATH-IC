/** Cap only — height follows content; SettlementModePanel stack keeps cash/metal toggle stable. */
export const icPurchaseModalShell = 'sm:max-h-[min(88dvh,720px)]';

export const icSaleModalShell = 'sm:max-h-[min(88dvh,720px)]';

export const icFormModalBody = 'sm:py-1.5 sm:px-3';

/** Sale modal: column layout so captured image can grow to fill left pane. */
export const icSaleFormModalBody =
  `${icFormModalBody} lg:flex lg:min-h-0 lg:flex-1 lg:flex-col`;

export const icSaleFormGridClass =
  `grid min-h-0 grid-cols-1 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:items-stretch`;

export const icWarehouseStockBannerMinH = 'min-h-[1.75rem]';

export const icPurchaseStockContextMinH = 'min-h-[2.25rem]';

export const icFormSectionHeading =
  'border-b border-slate-100 pb-0.5 text-sm font-bold text-slate-900 dark:border-[var(--theme-border)] dark:text-[var(--theme-text)]';

export const icFormColumnGap = 'gap-2';
export const icFormGridGap = 'gap-3';

export const icFormTotalsLabel =
  'text-[10px] font-bold uppercase tracking-wider text-slate-500';
