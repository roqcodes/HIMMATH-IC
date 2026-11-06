import React from 'react';
import type { DealInvoiceDoc } from '@/lib/icTransfer/dealInvoice';

function CurrencySymbol({ currency }: { currency: string }) {
  if (currency === 'INR') {
    return <span className="mr-1 text-[11px] font-medium text-black">₹</span>;
  }
  // Stylized UAE dirham emblem matching the reference document
  return (
    <span className="mr-1 inline-flex items-center text-[10px] font-medium text-black" aria-label="AED">
      <span className="font-mono text-[9px] tracking-tighter">AED</span>
    </span>
  );
}

function TotalBarCurrencySymbol({ currency }: { currency: string }) {
  if (currency === 'INR') {
    return <span className="mr-1 text-[13px] font-medium text-white">₹</span>;
  }
  return (
    <span className="mr-1 inline-flex items-center text-[11px] font-medium text-white" aria-label="AED">
      <span className="font-mono text-[10px] tracking-tighter">AED</span>
    </span>
  );
}

export default function DealInvoiceDocument({ doc }: { doc: DealInvoiceDoc }) {
  return (
    <article className="di-sheet mx-auto w-[210mm] min-h-[297mm] bg-white text-black font-sans antialiased box-border p-[14mm_16mm_12mm] shadow-[0_4px_24px_rgba(0,0,0,0.08)] print:shadow-none print:p-0">
      {/* 1. Header with Real Brand Logo */}
      <header className="flex items-start gap-3.5">
        <img
          src={doc.issuer.logoUrl}
          alt="Himmath Gold & Diamonds"
          width={40}
          height={40}
          decoding="async"
          className="size-10 object-contain shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-[15px] font-medium tracking-tight text-black leading-tight">
            {doc.issuer.name}
          </h1>
          {doc.issuer.addressLines.map(line => (
            <p key={line} className="text-[10.5px] font-normal text-black mt-0.5 leading-tight">
              {line}
            </p>
          ))}
          {doc.issuer.phone ? (
            <p className="text-[10.5px] font-normal text-black mt-0.5 leading-tight">
              {doc.issuer.phone}
            </p>
          ) : null}
        </div>
      </header>

      {/* 2. Double Black Line Divider */}
      <div className="mt-3.5 space-y-[2px]">
        <div className="h-[2px] bg-black w-full" />
        <div className="h-[1px] bg-black w-full" />
      </div>

      {/* 3. Title Row with Arabic Translation on Right */}
      <div className="mt-4 flex items-baseline justify-between">
        <h2 className="text-[23px] font-medium tracking-tight text-black">
          {doc.titleEn}
        </h2>
        <span className="text-[16px] font-normal text-black" dir="rtl" lang="ar">
          {doc.titleAr}
        </span>
      </div>

      {/* 4. Meta 4-Column Card (NUMBER, DATE, BRANCH, CURRENCY) */}
      <div className="mt-3.5 border border-neutral-300 rounded-lg grid grid-cols-4 divide-x divide-neutral-300 bg-white">
        <div className="p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[8.5px] font-medium text-black uppercase tracking-wider">
              NUMBER
            </span>
            <span className="text-[9.5px] font-normal text-black" dir="rtl" lang="ar">
              الرقم
            </span>
          </div>
          <p className="text-[12.5px] font-medium text-black mt-1 tracking-tight">
            {doc.number}
          </p>
        </div>

        <div className="p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[8.5px] font-medium text-black uppercase tracking-wider">
              DATE
            </span>
            <span className="text-[9.5px] font-normal text-black" dir="rtl" lang="ar">
              التاريخ
            </span>
          </div>
          <p className="text-[12.5px] font-medium text-black mt-1 tracking-tight">
            {doc.dateLabel}
          </p>
        </div>

        <div className="p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[8.5px] font-medium text-black uppercase tracking-wider">
              BRANCH
            </span>
            <span className="text-[9.5px] font-normal text-black" dir="rtl" lang="ar">
              الفرع
            </span>
          </div>
          <p className="text-[12.5px] font-medium text-black mt-1 tracking-tight">
            {doc.branchName}
          </p>
        </div>

        <div className="p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[8.5px] font-medium text-black uppercase tracking-wider">
              CURRENCY
            </span>
            <span className="text-[9.5px] font-normal text-black" dir="rtl" lang="ar">
              العملة
            </span>
          </div>
          <p className="text-[12.5px] font-medium text-black mt-1 tracking-tight">
            {doc.currency}
          </p>
        </div>
      </div>

      {/* 5. Middle Split Cards (SUPPLIER/CUSTOMER & RECEIPT DETAILS) */}
      <div className="mt-3 grid grid-cols-2 gap-3 items-stretch">
        <section className="border border-neutral-300 rounded-lg p-3.5 bg-white flex flex-col justify-between min-h-[112px]">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[8.5px] font-medium text-black uppercase tracking-wider">
                {doc.partyLabel.toUpperCase()}
              </span>
              <span className="text-[9.5px] font-normal text-black" dir="rtl" lang="ar">
                {doc.partyLabelAr}
              </span>
            </div>
            <p className="text-[13px] font-medium uppercase text-black mt-2.5 tracking-tight">
              {doc.partyName}
            </p>
          </div>
          {doc.partyHint ? (
            <p className="text-[11px] font-normal text-black mt-2 leading-normal">{doc.partyHint}</p>
          ) : null}
        </section>

        <section className="border border-neutral-300 rounded-lg p-3.5 bg-white flex flex-col justify-between min-h-[112px]">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[8.5px] font-medium text-black uppercase tracking-wider">
                {doc.detailsTitle.toUpperCase()}
              </span>
              <span className="text-[9.5px] font-normal text-black" dir="rtl" lang="ar">
                {doc.detailsTitleAr}
              </span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {doc.details.map((line, idx) => (
                <p
                  key={`${idx}-${line}`}
                  className={
                    idx === 0
                      ? 'text-[13px] font-medium text-black leading-snug'
                      : 'text-[11px] font-normal text-black leading-snug'
                  }
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* 6. Table 1: ITEM / SERIAL */}
      <div className="mt-3 border border-neutral-300 rounded-lg overflow-hidden bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#f9fafb] border-b border-neutral-300">
              <th className="py-2.5 px-3 text-[8.5px] font-medium text-black uppercase tracking-wider">
                ITEM / SERIAL
              </th>
              <th className="py-2.5 px-3 text-[8.5px] font-medium text-black uppercase tracking-wider text-center">
                PURITY
              </th>
              <th className="py-2.5 px-3 text-[8.5px] font-medium text-black uppercase tracking-wider text-center">
                PCS
              </th>
              <th className="py-2.5 px-3 text-[8.5px] font-medium text-black uppercase tracking-wider text-right">
                GROSS · G
              </th>
              <th className="py-2.5 px-3 text-[8.5px] font-medium text-black uppercase tracking-wider text-right">
                PURE · G
              </th>
              <th className="py-2.5 px-3 text-[8.5px] font-medium text-black uppercase tracking-wider text-right">
                RECEIPT VALUE · {doc.currency}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3 px-3 align-top">
                <p className="text-[12px] font-medium text-black uppercase">
                  {doc.item.name}
                </p>
                <p className="text-[10px] font-normal text-black mt-1">{doc.item.serial}</p>
                <p className="text-[10px] font-normal text-black mt-0.5">{doc.item.status}</p>
              </td>
              <td className="py-3 px-3 align-top text-center text-[11.5px] text-black">
                {doc.item.purity}
              </td>
              <td className="py-3 px-3 align-top text-center text-[11.5px] text-black">
                {doc.item.pcs}
              </td>
              <td className="py-3 px-3 align-top text-right text-[11.5px] text-black tabular-nums">
                {doc.item.grossG}
              </td>
              <td className="py-3 px-3 align-top text-right text-[11.5px] text-black tabular-nums">
                {doc.item.pureG}
              </td>
              <td className="py-3 px-3 align-top text-right text-[12px] font-medium text-black tabular-nums whitespace-nowrap">
                <CurrencySymbol currency={doc.currency} />
                {doc.item.value.replace(/^(AED|INR)\s*/, '')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 7. Table 2: LINE / PRICING */}
      <div className="mt-3 border border-neutral-300 rounded-lg overflow-hidden bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#f9fafb] border-b border-neutral-300">
              <th className="py-2.5 px-3 text-[8.5px] font-medium text-black uppercase tracking-wider w-[22%]">
                LINE / PRICING
              </th>
              <th className="py-2.5 px-3 text-[8.5px] font-medium text-black uppercase tracking-wider w-[28%]">
                ORIGINAL RATE
              </th>
              <th className="py-2.5 px-3 text-[8.5px] font-medium text-black uppercase tracking-wider w-[25%]">
                ADJUSTMENT
              </th>
              <th className="py-2.5 px-3 text-[8.5px] font-medium text-black uppercase tracking-wider w-[25%]">
                FX / RATE SOURCE
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3 px-3 align-top">
                <p className="text-[11.5px] font-medium text-black">1</p>
                <p className="text-[10px] font-normal text-black mt-1">{doc.pricing.kind}</p>
              </td>
              <td className="py-3 px-3 align-top text-[11.5px] text-black tabular-nums">
                {doc.pricing.originalRate}
              </td>
              <td className="py-3 px-3 align-top">
                <p className="text-[11.5px] text-black">{doc.pricing.adjustmentLabel}</p>
                <p className="text-[10px] font-normal text-black mt-1 tabular-nums">
                  {doc.pricing.adjustmentRate}
                </p>
              </td>
              <td className="py-3 px-3 align-top">
                <p className="text-[11.5px] font-medium text-black">{doc.pricing.fxRate}</p>
                <p className="text-[10px] font-normal text-black mt-1">{doc.pricing.rateSource}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 8. Summary & total — single bordered container */}
      <div className="ml-auto mt-4 w-[320px] overflow-hidden rounded-xl border border-neutral-300 bg-white">
        <div className="space-y-2.5 px-4 py-3.5">
          {doc.summary.map(row => (
            <div
              key={row.label}
              className="flex items-baseline justify-between text-[11.5px] font-normal text-black"
            >
              <span>{row.label}</span>
              <span className="font-medium tabular-nums text-black">
                {row.value.startsWith('AED ') || row.value.startsWith('INR ') ? (
                  <>
                    <CurrencySymbol currency={doc.currency} />
                    {row.value.replace(/^(AED|INR)\s*/, '')}
                  </>
                ) : (
                  row.value
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between bg-black px-4 py-3 text-white rounded-b-[10px]">
          <span className="text-[10px] font-medium uppercase tracking-wider text-white">
            RECEIPT VALUE · {doc.currency}
          </span>
          <span className="flex items-center text-[14.5px] font-medium tabular-nums text-white">
            <TotalBarCurrencySymbol currency={doc.currency} />
            {doc.totalBarValue.replace(/^(AED|INR)\s*/, '')}
          </span>
        </div>
      </div>

      {/* 9. Notes Section */}
      <div className="mt-8 text-[10.5px] font-normal text-black leading-relaxed space-y-2 max-w-full break-words">
        {doc.notes.map(note => (
          <p key={note} className="max-w-full break-words text-pretty">{note}</p>
        ))}
      </div>

      {/* 10. Footer */}
      <footer className="mt-10 pt-3 border-t border-neutral-300 flex justify-between text-[9px] font-normal text-black">
        <span>{doc.footerLeft}</span>
        <span className="font-mono">{doc.footerRight}</span>
      </footer>
    </article>
  );
}
