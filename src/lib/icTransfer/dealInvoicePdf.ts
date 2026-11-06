import type { DealInvoiceDoc } from '@/lib/icTransfer/dealInvoice';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;

function pdfEscape(raw: string): string {
  const latin = raw.replace(/[^\x20-\x7E]/g, s => {
    const c = s.charCodeAt(0);
    return c < 256 ? String.fromCharCode(c) : ' ';
  });
  return latin.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

class PdfPage {
  ops: string[] = [];

  rgb(r: number, g: number, b: number): string {
    return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
  }

  strokeRect(x: number, y: number, w: number, h: number, r = 209, g = 213, b = 219) {
    this.ops.push(`${this.rgb(r, g, b)} RG`);
    this.ops.push('0.6 w');
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }

  fillRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    this.ops.push(`${this.rgb(r, g, b)} rg`);
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, r = 209, g = 213, b = 219) {
    this.ops.push(`${this.rgb(r, g, b)} RG`);
    this.ops.push('0.5 w');
    this.ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  text(x: number, y: number, value: string, size: number, bold = false, r = 17, g = 24, b = 39) {
    const font = bold ? 'F2' : 'F1';
    this.ops.push('BT');
    this.ops.push(`/${font} ${size} Tf`);
    this.ops.push(`${this.rgb(r, g, b)} rg`);
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    this.ops.push(`(${pdfEscape(value)}) Tj`);
    this.ops.push('ET');
  }

  textRight(right: number, y: number, value: string, size: number, bold = false, r = 17, g = 24, b = 39) {
    const w = value.length * size * 0.5;
    this.text(right - w, y, value, size, bold, r, g, b);
  }
}

const encoder = new TextEncoder();

export function wrapJpegInPdf(jpegBytes: Uint8Array, width: number, height: number): Uint8Array {
  const contentStream = `q ${PAGE_W} 0 0 ${PAGE_H} 0 0 cm /Im1 Do Q`;
  const contentBytes = encoder.encode(contentStream);

  const header = encoder.encode('%PDF-1.4\n');
  const obj1 = encoder.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const obj2 = encoder.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  const obj3 = encoder.encode(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`);
  const obj4 = encoder.encode(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);
  const obj5Prefix = encoder.encode(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  const obj5Suffix = encoder.encode('\nendstream\nendobj\n');

  let offset = header.length;
  const o1 = offset; offset += obj1.length;
  const o2 = offset; offset += obj2.length;
  const o3 = offset; offset += obj3.length;
  const o4 = offset; offset += obj4.length;
  const o5 = offset; offset += obj5Prefix.length + jpegBytes.length + obj5Suffix.length;

  const xrefStart = offset;
  const pad = (n: number) => String(n).padStart(10, '0');
  const xref = encoder.encode(
    'xref\n0 6\n0000000000 65535 f \n' +
    `${pad(o1)} 00000 n \n` +
    `${pad(o2)} 00000 n \n` +
    `${pad(o3)} 00000 n \n` +
    `${pad(o4)} 00000 n \n` +
    `${pad(o5)} 00000 n \n`
  );
  const trailer = encoder.encode(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const total = header.length + obj1.length + obj2.length + obj3.length + obj4.length + obj5Prefix.length + jpegBytes.length + obj5Suffix.length + xref.length + trailer.length;
  const out = new Uint8Array(total);
  let cur = 0;
  const append = (chunk: Uint8Array) => {
    out.set(chunk, cur);
    cur += chunk.length;
  };
  append(header);
  append(obj1);
  append(obj2);
  append(obj3);
  append(obj4);
  append(obj5Prefix);
  append(jpegBytes);
  append(obj5Suffix);
  append(xref);
  append(trailer);
  return out;
}

function assemblePdf(content: string): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  const chunks: Uint8Array[] = [encoder.encode('%PDF-1.4\n')];
  const offsets = [0];
  let size = chunks[0].length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(size);
    const part = encoder.encode(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
    chunks.push(part);
    size += part.length;
  }
  const xrefStart = size;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  chunks.push(encoder.encode(xref));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function buildDealInvoicePdf(doc: DealInvoiceDoc): Uint8Array {
  const p = new PdfPage();
  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  const width = right - left;
  let y = PAGE_H - 46;

  // Header
  p.text(left + 26, y, doc.issuer.name, 12, false, 0, 0, 0);
  y -= 12;
  p.text(left + 26, y, doc.issuer.addressLines[0] || '', 8, false, 0, 0, 0);
  y -= 10;
  if (doc.issuer.phone) {
    p.text(left + 26, y, doc.issuer.phone, 8, false, 0, 0, 0);
    y -= 8;
  }

  // Double horizontal rule under header
  y -= 4;
  p.fillRect(left, y, width, 1.8, 17, 24, 39);
  p.fillRect(left, y - 3, width, 0.8, 17, 24, 39);

  // Title Row
  y -= 26;
  p.text(left, y, doc.titleEn, 19, false, 0, 0, 0);

  // Meta 4-column card
  y -= 18;
  const metaH = 38;
  const colW = width / 4;
  p.strokeRect(left, y - metaH, width, metaH);
  for (let i = 1; i < 4; i++) {
    p.line(left + i * colW, y, left + i * colW, y - metaH);
  }

  const metas = [
    { k: 'NUMBER', v: doc.number },
    { k: 'DATE', v: doc.dateLabel },
    { k: 'BRANCH', v: doc.branchName },
    { k: 'CURRENCY', v: doc.currency },
  ];
  metas.forEach((m, i) => {
    const cx = left + i * colW;
    p.text(cx + 8, y - 11, m.k, 6, false, 0, 0, 0);
    p.text(cx + 8, y - 26, m.v, 9, false, 0, 0, 0);
  });

  // Middle 2 cards
  y -= metaH + 10;
  const half = (width - 10) / 2;
  const detailLineH = 11;
  const leftPanelH = doc.partyHint ? 58 : 44;
  const rightPanelH = 22 + doc.details.length * detailLineH + 10;
  const panelH = Math.max(leftPanelH, rightPanelH, 52);
  p.strokeRect(left, y - panelH, half, panelH);
  p.strokeRect(left + half + 10, y - panelH, half, panelH);

  p.text(left + 10, y - 13, doc.partyLabel.toUpperCase(), 6, false, 0, 0, 0);
  p.text(left + 10, y - 30, doc.partyName, 10, false, 0, 0, 0);
  if (doc.partyHint) p.text(left + 10, y - 44, doc.partyHint, 8, false, 0, 0, 0);

  p.text(left + half + 20, y - 13, doc.detailsTitle.toUpperCase(), 6, false, 0, 0, 0);
  doc.details.forEach((line, i) => {
    const size = i === 0 ? 9 : 8;
    p.text(left + half + 20, y - 30 - i * detailLineH, line, size, false, 0, 0, 0);
  });

  // Table 1: ITEM / SERIAL
  y -= panelH + 12;
  const t1H = 56;
  const th1H = 18;
  p.strokeRect(left, y - t1H, width, t1H);
  p.fillRect(left, y - th1H, width, th1H, 249, 250, 251);
  p.line(left, y - th1H, right, y - th1H);

  p.text(left + 8, y - 12, 'ITEM / SERIAL', 6, false, 0, 0, 0);
  p.text(left + 180, y - 12, 'PURITY', 6, false, 0, 0, 0);
  p.text(left + 240, y - 12, 'PCS', 6, false, 0, 0, 0);
  p.textRight(left + 340, y - 12, 'GROSS . G', 6, false, 0, 0, 0);
  p.textRight(left + 410, y - 12, 'PURE . G', 6, false, 0, 0, 0);
  p.textRight(right - 8, y - 12, `RECEIPT VALUE . ${doc.currency}`, 6, false, 0, 0, 0);

  p.text(left + 8, y - 28, doc.item.name, 9, false, 0, 0, 0);
  p.text(left + 8, y - 39, doc.item.serial, 7, false, 0, 0, 0);
  p.text(left + 8, y - 48, doc.item.status, 7, false, 0, 0, 0);
  p.text(left + 180, y - 32, doc.item.purity, 9);
  p.text(left + 240, y - 32, doc.item.pcs, 9);
  p.textRight(left + 340, y - 32, doc.item.grossG, 9);
  p.textRight(left + 410, y - 32, doc.item.pureG, 9);
  p.textRight(right - 8, y - 32, doc.item.value, 9, false, 0, 0, 0);

  // Table 2: LINE / PRICING
  y -= t1H + 10;
  const t2H = 46;
  p.strokeRect(left, y - t2H, width, t2H);
  p.fillRect(left, y - th1H, width, th1H, 249, 250, 251);
  p.line(left, y - th1H, right, y - th1H);

  p.text(left + 8, y - 12, 'LINE / PRICING', 6, false, 0, 0, 0);
  p.text(left + 130, y - 12, 'ORIGINAL RATE', 6, false, 0, 0, 0);
  p.text(left + 270, y - 12, 'ADJUSTMENT', 6, false, 0, 0, 0);
  p.text(left + 390, y - 12, 'FX / RATE SOURCE', 6, false, 0, 0, 0);

  p.text(left + 8, y - 27, '1', 9, false, 0, 0, 0);
  p.text(left + 8, y - 38, doc.pricing.kind, 7, false, 0, 0, 0);
  p.text(left + 130, y - 28, doc.pricing.originalRate, 9, false, 0, 0, 0);
  p.text(left + 270, y - 27, doc.pricing.adjustmentLabel, 9, false, 0, 0, 0);
  p.text(left + 270, y - 38, doc.pricing.adjustmentRate, 7, false, 0, 0, 0);
  p.text(left + 390, y - 27, doc.pricing.fxRate, 9, false, 0, 0, 0);
  p.text(left + 390, y - 38, doc.pricing.rateSource, 7, false, 0, 0, 0);

  // Summary & total — bordered container
  y -= t2H + 16;
  const sumLeft = left + width * 0.52;
  const sumW = right - sumLeft;
  const sumPad = 10;
  const sumRowH = 13;
  const sumRowsBlockH = doc.summary.length * sumRowH + sumPad + 6;
  const barH = 24;
  const boxH = sumRowsBlockH + barH;
  const boxBottom = y + 4;
  const boxTop = boxBottom - boxH;

  p.strokeRect(sumLeft, boxTop, sumW, boxH);

  let rowY = boxTop + sumPad + 8;
  for (const row of doc.summary) {
    p.text(sumLeft + sumPad, rowY, row.label, 8, false, 0, 0, 0);
    p.textRight(right - sumPad, rowY, row.value, 8, false, 0, 0, 0);
    rowY += sumRowH;
  }

  const barY = boxTop + sumRowsBlockH;
  p.fillRect(sumLeft, barY, sumW, barH, 17, 24, 39);
  p.text(sumLeft + 10, barY + 16, `RECEIPT VALUE . ${doc.currency}`, 7, true, 255, 255, 255);
  p.textRight(right - 10, barY + 16, doc.totalBarValue, 10, true, 255, 255, 255);

  // Notes
  y = boxTop - 28;
  for (const note of doc.notes) {
    wrap(note, 94).forEach(line => {
      p.text(left, y, line, 7, false, 0, 0, 0);
      y -= 10;
    });
    y -= 4;
  }

  // Footer
  p.line(left, 46, right, 46);
  p.text(left, 32, doc.footerLeft, 7, false, 0, 0, 0);
  p.textRight(right, 32, doc.footerRight, 7, false, 0, 0, 0);

  return assemblePdf(p.ops.join('\n'));
}
