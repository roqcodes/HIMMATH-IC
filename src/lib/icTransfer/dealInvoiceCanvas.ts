import type { DealInvoiceDoc } from '@/lib/icTransfer/dealInvoice';

/** Logical page size (A4 proportion); bitmap is scaled up for sharp PDF export. */
export const DEAL_INVOICE_LAYOUT_W = 1240;
export const DEAL_INVOICE_LAYOUT_H = 1754;
/** ~300 DPI when the bitmap is fitted to A4 in the PDF (2480×3508 px). */
export const DEAL_INVOICE_EXPORT_SCALE = 2.5;

const CANVAS_W = DEAL_INVOICE_LAYOUT_W;
const CANVAS_H = DEAL_INVOICE_LAYOUT_H;

function roundRectPolyfill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number | [number, number, number, number],
) {
  const [tl, tr, br, bl] = typeof radii === 'number'
    ? [radii, radii, radii, radii]
    : radii;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr > 0) ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  if (br > 0) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  if (bl > 0) ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  if (tl > 0) ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const test = `${cur} ${word}`;
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  lines.push(cur);
  return lines;
}

function loadLogoImage(logoUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Logo failed to load'));
    img.src = logoUrl;
  });
}

export async function renderDealInvoiceToCanvas(doc: DealInvoiceDoc): Promise<HTMLCanvasElement> {
  const scale = DEAL_INVOICE_EXPORT_SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(CANVAS_W * scale);
  canvas.height = Math.round(CANVAS_H * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const left = 90;
  const right = 1150;
  const width = right - left; // 1060
  const INK = '#000000';
  const fontMedium = (size: number) => `500 ${size}px Inter, system-ui, sans-serif`;
  const fontRegular = (size: number) => `${size}px Inter, system-ui, sans-serif`;

  // 1. Logo + Company Header
  try {
    const logoImg = await loadLogoImage(doc.issuer.logoUrl);
    if (logoImg.naturalWidth) {
      const logoH = 52;
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      ctx.drawImage(logoImg, left, 70, logoW, logoH);
    }
  } catch {
    // skip logo if asset unavailable
  }

  const textLeft = left + 62;
  ctx.font = fontMedium(28);
  ctx.fillStyle = INK;
  ctx.fillText(doc.issuer.name, textLeft, 96);

  ctx.font = fontRegular(19);
  ctx.fillStyle = INK;
  ctx.fillText(doc.issuer.addressLines[0] || '', textLeft, 126);
  if (doc.issuer.phone) {
    ctx.fillText(doc.issuer.phone, textLeft, 152);
  }

  // 2. Double Horizontal Line
  ctx.fillStyle = INK;
  ctx.fillRect(left, 178, width, 3.5);
  ctx.fillRect(left, 185, width, 1.5);

  // 3. Title Row
  ctx.font = fontMedium(44);
  ctx.fillStyle = INK;
  ctx.fillText(doc.titleEn, left, 246);

  ctx.font = fontRegular(28);
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.fillText(doc.titleAr, right, 246);
  ctx.textAlign = 'left';

  // 4. Meta 4-column card
  const metaY = 278;
  const metaH = 92;
  const colW = width / 4;

  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1.0;
  roundRectPolyfill(ctx, left, metaY, width, metaH, 12);
  ctx.stroke();

  // Vertical dividers
  for (let i = 1; i < 4; i++) {
    const vx = left + i * colW;
    ctx.beginPath();
    ctx.moveTo(vx, metaY);
    ctx.lineTo(vx, metaY + metaH);
    ctx.stroke();
  }

  const metaCols = [
    { en: 'NUMBER', ar: 'الرقم', v: doc.number },
    { en: 'DATE', ar: 'التاريخ', v: doc.dateLabel },
    { en: 'BRANCH', ar: 'الفرع', v: doc.branchName },
    { en: 'CURRENCY', ar: 'العملة', v: doc.currency },
  ];

  metaCols.forEach((m, i) => {
    const cx = left + i * colW;
    ctx.font = fontMedium(15);
    ctx.fillStyle = INK;
    ctx.fillText(m.en, cx + 18, metaY + 32);

    ctx.font = '17px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = INK;
    ctx.fillText(m.ar, cx + colW - 18, metaY + 32);
    ctx.textAlign = 'left';

    ctx.font = fontMedium(23);
    ctx.fillStyle = INK;
    ctx.fillText(m.v, cx + 18, metaY + 70);
  });

  // 5. Middle Split Cards (Party & Details)
  const cardY = 394;
  const halfW = (width - 24) / 2;
  const detailLineStep = 30;
  const detailContentH = 44 + Math.max(doc.details.length, 1) * detailLineStep + 18;
  const partyContentH = doc.partyHint ? 134 : 100;
  const cardH = Math.max(detailContentH, partyContentH, 120);

  // Left card (Supplier / Customer)
  roundRectPolyfill(ctx, left, cardY, halfW, cardH, 12);
  ctx.stroke();

  ctx.font = fontMedium(15);
  ctx.fillStyle = INK;
  ctx.fillText(doc.partyLabel.toUpperCase(), left + 20, cardY + 34);

  ctx.font = '17px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.fillText(doc.partyLabelAr, left + halfW - 20, cardY + 34);
  ctx.textAlign = 'left';

  ctx.font = fontMedium(24);
  ctx.fillStyle = INK;
  ctx.fillText(doc.partyName.toUpperCase(), left + 20, cardY + 76);

  if (doc.partyHint) {
    ctx.font = fontRegular(20);
    ctx.fillStyle = INK;
    ctx.fillText(doc.partyHint, left + 20, cardY + 114);
  }

  // Right card (Receipt details)
  const rightCardX = left + halfW + 24;
  roundRectPolyfill(ctx, rightCardX, cardY, halfW, cardH, 12);
  ctx.stroke();

  ctx.font = fontMedium(15);
  ctx.fillStyle = INK;
  ctx.fillText(doc.detailsTitle.toUpperCase(), rightCardX + 20, cardY + 34);

  ctx.font = '17px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.fillText(doc.detailsTitleAr, rightCardX + halfW - 20, cardY + 34);
  ctx.textAlign = 'left';

  doc.details.forEach((line, idx) => {
    ctx.font = idx === 0 ? fontMedium(24) : fontRegular(20);
    ctx.fillStyle = INK;
    ctx.fillText(line, rightCardX + 20, cardY + 76 + idx * detailLineStep);
  });

  // 6. Table 1: ITEM / SERIAL
  const t1Y = cardY + cardH + 24;
  const t1H = 152;
  const thH = 46;

  // Header fill
  ctx.fillStyle = '#f9fafb';
  roundRectPolyfill(ctx, left, t1Y, width, thH, [12, 12, 0, 0]);
  ctx.fill();

  roundRectPolyfill(ctx, left, t1Y, width, t1H, 12);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(left, t1Y + thH);
  ctx.lineTo(right, t1Y + thH);
  ctx.stroke();

  // Header labels
  ctx.font = fontMedium(15);
  ctx.fillStyle = INK;
  ctx.fillText('ITEM / SERIAL', left + 20, t1Y + 30);
  ctx.textAlign = 'center';
  ctx.fillText('PURITY', left + 430, t1Y + 30);
  ctx.fillText('PCS', left + 560, t1Y + 30);
  ctx.textAlign = 'right';
  ctx.fillText('GROSS · G', left + 730, t1Y + 30);
  ctx.fillText('PURE · G', left + 860, t1Y + 30);
  ctx.fillText(`RECEIPT VALUE · ${doc.currency}`, right - 20, t1Y + 30);
  ctx.textAlign = 'left';

  // Row 1 values
  ctx.font = fontMedium(22);
  ctx.fillStyle = INK;
  ctx.fillText(doc.item.name, left + 20, t1Y + 82);

  ctx.font = fontRegular(18);
  ctx.fillStyle = INK;
  ctx.fillText(doc.item.serial, left + 20, t1Y + 110);

  ctx.fillStyle = INK;
  ctx.fillText(doc.item.status, left + 20, t1Y + 134);

  ctx.font = fontRegular(21);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(doc.item.purity, left + 430, t1Y + 92);
  ctx.fillText(doc.item.pcs, left + 560, t1Y + 92);

  ctx.textAlign = 'right';
  ctx.fillText(doc.item.grossG, left + 730, t1Y + 92);
  ctx.fillText(doc.item.pureG, left + 860, t1Y + 92);

  ctx.font = fontMedium(22);
  ctx.fillText(doc.item.value, right - 20, t1Y + 92);
  ctx.textAlign = 'left';

  // 7. Table 2: LINE / PRICING
  const t2Y = t1Y + t1H + 24;
  const t2H = 124;

  ctx.fillStyle = '#f9fafb';
  roundRectPolyfill(ctx, left, t2Y, width, thH, [12, 12, 0, 0]);
  ctx.fill();

  roundRectPolyfill(ctx, left, t2Y, width, t2H, 12);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(left, t2Y + thH);
  ctx.lineTo(right, t2Y + thH);
  ctx.stroke();

  ctx.font = fontMedium(15);
  ctx.fillStyle = INK;
  ctx.fillText('LINE / PRICING', left + 20, t2Y + 30);
  ctx.fillText('ORIGINAL RATE', left + 260, t2Y + 30);
  ctx.fillText('ADJUSTMENT', left + 560, t2Y + 30);
  ctx.fillText('FX / RATE SOURCE', left + 830, t2Y + 30);

  ctx.font = fontMedium(21);
  ctx.fillStyle = INK;
  ctx.fillText('1', left + 20, t2Y + 78);
  ctx.font = fontRegular(18);
  ctx.fillStyle = INK;
  ctx.fillText(doc.pricing.kind, left + 20, t2Y + 104);

  ctx.font = fontRegular(21);
  ctx.fillStyle = INK;
  ctx.fillText(doc.pricing.originalRate, left + 260, t2Y + 84);

  ctx.fillText(doc.pricing.adjustmentLabel, left + 560, t2Y + 78);
  ctx.font = fontRegular(18);
  ctx.fillStyle = INK;
  ctx.fillText(doc.pricing.adjustmentRate, left + 560, t2Y + 104);

  ctx.font = fontMedium(21);
  ctx.fillStyle = INK;
  ctx.fillText(doc.pricing.fxRate, left + 830, t2Y + 78);
  ctx.font = fontRegular(18);
  ctx.fillStyle = INK;
  ctx.fillText(doc.pricing.rateSource, left + 830, t2Y + 104);

  // 8. Summary & total — bordered container with rounded bottom
  const sumW = 480;
  const sumLeft = right - sumW;
  const sumPad = 18;
  const sumRowStep = 32;
  const sumRowsH = doc.summary.length * sumRowStep + sumPad * 2;
  const barH = 62;
  const boxH = sumRowsH + barH;
  const boxTop = t2Y + t2H + 28;
  const boxRadius = 14;

  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1.0;
  roundRectPolyfill(ctx, sumLeft, boxTop, sumW, boxH, boxRadius);
  ctx.stroke();

  let rowY = boxTop + sumPad + 22;
  doc.summary.forEach(row => {
    ctx.font = fontRegular(20);
    ctx.fillStyle = INK;
    ctx.fillText(row.label, sumLeft + sumPad, rowY);

    ctx.font = fontMedium(21);
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    ctx.fillText(row.value, right - sumPad, rowY);
    ctx.textAlign = 'left';
    rowY += sumRowStep;
  });

  const barY = boxTop + sumRowsH;
  ctx.fillStyle = INK;
  roundRectPolyfill(ctx, sumLeft, barY, sumW, barH, [0, 0, boxRadius, boxRadius]);
  ctx.fill();

  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1.0;
  roundRectPolyfill(ctx, sumLeft, boxTop, sumW, boxH, boxRadius);
  ctx.stroke();

  ctx.font = fontMedium(17);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`RECEIPT VALUE · ${doc.currency}`, sumLeft + 22, barY + 38);

  ctx.font = fontMedium(28);
  ctx.textAlign = 'right';
  ctx.fillText(doc.totalBarValue, right - 22, barY + 40);
  ctx.textAlign = 'left';

  // 9. Notes (with word wrapping to prevent horizontal overflow)
  let noteY = boxTop + boxH + 34;
  ctx.font = fontRegular(17);
  ctx.fillStyle = INK;
  doc.notes.forEach(note => {
    const wrappedLines = wrapCanvasText(ctx, note, width);
    wrappedLines.forEach(line => {
      ctx.fillText(line, left, noteY);
      noteY += 28;
    });
    noteY += 6;
  });

  // 10. Footer
  const footY = 1660;
  ctx.beginPath();
  ctx.moveTo(left, footY);
  ctx.lineTo(right, footY);
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1.0;
  ctx.stroke();

  ctx.font = fontRegular(17);
  ctx.fillStyle = INK;
  ctx.fillText(doc.footerLeft, left, footY + 34);

  ctx.textAlign = 'right';
  ctx.fillText(doc.footerRight, right, footY + 34);
  ctx.textAlign = 'left';

  return canvas;
}
