/** Cap only — height follows content; SmoothHeight on settlement panel animates cash/metal toggles. */
export const icPurchaseModalShell = 'max-h-[90vh] sm:max-h-[90vh]';

export const icSaleModalShell = icPurchaseModalShell;

export const icFormModalBody = 'sm:py-1.5 sm:px-3';

/** Purchase modal: on lg+, cap body scroll so settlement column can scroll independently. */
export const icPurchaseFormModalBody =
  `${icFormModalBody} lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden lg:overflow-y-hidden`;

export const icPurchaseFormGridClass =
  `grid min-h-0 grid-cols-1 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:items-stretch`;

/** Sale modal: column layout so captured image can grow to fill left pane. */
export const icSaleFormModalBody =
  `${icFormModalBody} lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden`;

export const icSaleFormGridClass =
  `grid min-h-0 grid-cols-1 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:items-stretch`;

/** Right pane (cash / metal settlement): heading stays fixed; panel scrolls when tall. */
export const icSettlementColumnClass =
  `flex min-h-0 flex-col lg:col-span-7 lg:min-h-0 lg:border-l lg:border-slate-100 lg:pl-5 dark:lg:border-[var(--theme-border)]`;

/** Uppercase section eyebrow for dense IC transfer modals. */
export const icFormSectionEyebrow =
  'text-xs font-semibold uppercase tracking-wider text-slate-500';

export const icPurchaseDenseLabel =
  'mb-1 block text-xs font-medium text-slate-700 dark:text-[var(--theme-text-secondary)]';

export const icPurchaseDenseInput =
  'h-9 rounded-md border-slate-300 focus-visible:border-blue-600 focus-visible:ring-1 focus-visible:ring-blue-600';

export const icPurchaseReadOnlyInput =
  'h-9 cursor-not-allowed rounded-md border border-dashed border-slate-300 bg-slate-100/70 font-semibold text-slate-900';

export const icSettlementPanelScroll =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5';

/** Left form column (warehouse, settlement fields): scroll on lg+ when modal body is capped. */
export const icFormLeftPanelClass =
  'flex min-h-0 flex-1 flex-col lg:col-span-8 lg:min-h-0 lg:max-h-full lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1';

/** Form grid inside purchase/sale modals — left column scrolls on large screens. */
export const icFormModalGridClass =
  'grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12 lg:items-stretch lg:overflow-hidden';

export const icWarehouseStockBannerMinH = 'min-h-[1.75rem]';

export const icPurchaseStockContextMinH = 'min-h-[2.25rem]';

export const icFormSectionHeading =
  'border-b border-slate-100 pb-1 text-sm font-bold text-slate-900 dark:border-[var(--theme-border)] dark:text-[var(--theme-text)]';

/** Single vertical rhythm for purchase/sale modals (cash + metal). */
export const icFormStackGap = 'gap-3';

export const icFormColumnGap = icFormStackGap;
export const icFormGridGap = icFormStackGap;
export const icFormModalFormGap = icFormStackGap;

/** Label → control within one field. */
export const icFormFieldInnerGap = 'gap-1.5';

export const icFormFieldStack = `flex min-w-0 flex-col ${icFormStackGap}`;

/** Two-column field rows (rate/units, warehouse/lot). */
export const icFormRowGrid = `grid grid-cols-1 ${icFormStackGap} sm:grid-cols-2`;

/** Dense voucher modals: full width of parent, 12-col on lg for field spans. */
export const icVoucherModalFieldGrid =
  'grid w-full min-w-0 grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-12 [&>*]:min-w-0';

/** Payment/receipt modals: manager, party account, optional agent — equal thirds, full row width. */
export const icVoucherPartyFieldsGrid =
  'grid w-full min-w-0 grid-cols-1 gap-x-3 gap-y-1 sm:col-span-2 sm:grid-cols-3 lg:col-span-12';

export const icVoucherPartyFieldsGridTwoCol =
  'grid w-full min-w-0 grid-cols-1 gap-x-3 gap-y-1 sm:col-span-2 sm:grid-cols-2 lg:col-span-12';

/** Voucher date / amount side by side on lg. */
export const icVoucherDateAmountFieldClass = 'sm:col-span-1 lg:col-span-6';

export const icVoucherFullRowFieldClass = 'sm:col-span-2 lg:col-span-12';

/** 12-col settlement fields — matches modal row spacing. */
export const icFormGrid =
  'grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-start lg:justify-items-stretch [&>*]:min-w-0 lg:[&>*:not([class*="col-span"])]:col-span-6';

export const icFormSectionDivider =
  'border-t border-slate-100 pt-3 dark:border-[var(--theme-border)]';

export const icFormTotalsLabel =
  'text-[10px] font-bold uppercase tracking-wider text-slate-500';
