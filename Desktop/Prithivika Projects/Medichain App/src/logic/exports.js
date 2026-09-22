// CSV and PDF downloads for the packs of one batch (for the printing line).
import { encodeQrPayload } from './qrPayload.js';
import { displayName } from './batchUtils.js';
import { formatDate } from '../utils/dateUtils.js';

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(batch, packs) {
  const header = ['Pack ID', 'Batch', 'Medicine', 'Pack size', 'MRP', 'Manufacturer', 'Mfg date', 'Expiry date', 'Signature', 'QR content'];
  const rows = packs.map((p) => [
    p.packId, batch.batchId, displayName(batch), batch.packSize, batch.mrp, batch.manufacturer,
    batch.mfgDate, batch.expiry, p.signature, encodeQrPayload(p.packId, p.signature),
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${batch.batchId}-packs.csv`);
}

// The two libraries are loaded only when the button is pressed, so the rest of the app stays fast.
export async function downloadPdf(batch, packs) {
  const [{ jsPDF }, QRCode] = await Promise.all([import('jspdf'), import('qrcode').then((m) => m.default || m)]);
  const doc = new jsPDF({ compress: true });
  const cols = 4, cellW = 47, cellH = 56, left = 12, top = 30;
  const rowsPerPage = 4;
  const perPage = cols * rowsPerPage;

  const drawHeader = () => {
    doc.setFontSize(14);
    doc.text(`MediChain: batch ${batch.batchId}, ${displayName(batch)}`, left, 14);
    doc.setFontSize(9);
    doc.text(`${batch.manufacturer}   Mfg ${formatDate(batch.mfgDate)}   Exp ${formatDate(batch.expiry)}`, left, 21);
  };

  drawHeader();
  for (let i = 0; i < packs.length; i++) {
    if (i > 0 && i % perPage === 0) {
      doc.addPage();
      drawHeader();
    }
    const slot = i % perPage;
    const x = left + (slot % cols) * cellW;
    const y = top + Math.floor(slot / cols) * cellH;
    const png = await QRCode.toDataURL(encodeQrPayload(packs[i].packId, packs[i].signature), { width: 240, margin: 1 });
    doc.addImage(png, 'PNG', x, y, 38, 38);
    doc.setFontSize(8);
    doc.text(packs[i].packId, x, y + 43);
  }
  doc.save(`${batch.batchId}-packs.pdf`);
}
