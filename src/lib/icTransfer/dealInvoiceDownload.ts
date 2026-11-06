import { buildDealInvoicePdf, wrapJpegInPdf } from '@/lib/icTransfer/dealInvoicePdf';
import { renderDealInvoiceToCanvas } from '@/lib/icTransfer/dealInvoiceCanvas';
import type { DealInvoiceDoc } from '@/lib/icTransfer/dealInvoice';

export async function downloadDealInvoicePdf(doc: DealInvoiceDoc): Promise<void> {
  let pdfBytes: Uint8Array;

  try {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = await renderDealInvoiceToCanvas(doc);
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', 1),
      );
      if (blob) {
        const arrayBuf = await blob.arrayBuffer();
        pdfBytes = wrapJpegInPdf(new Uint8Array(arrayBuf), canvas.width, canvas.height);
      } else {
        pdfBytes = buildDealInvoicePdf(doc);
      }
    } else {
      pdfBytes = buildDealInvoicePdf(doc);
    }
  } catch (err) {
    console.error('Canvas render failed, using vector PDF fallback:', err);
    pdfBytes = buildDealInvoicePdf(doc);
  }

  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_500);
}
