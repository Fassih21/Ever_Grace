export const CLINIC = {
  name: "Evergrace Aesthetics Clinic",
  address: "Township, Block 8, Sector B1, Lahore",
  phone: "", // e.g. "0300 1234567" (leave empty to hide)
  footer: "Thank you for choosing Evergrace.",
};

export type InvoiceLine = { service: string; when: string; price: number; discount: number; amount: number };
export type InvoicePayment = { date: string; method: string; amount: number };
export type InvoiceData = {
  number: string;
  date: string;
  patient: { name: string; phone: string };
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  extraDiscount?: number;
  hideDiscount?: boolean;
};

const rs = (n: number) => `Rs ${n.toLocaleString("en-US")}`;

async function loadLogo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const b = await (await fetch("/logo.png")).blob();
    const data = await new Promise<string>((r, j) => { const f = new FileReader(); f.onload = () => r(f.result as string); f.onerror = j; f.readAsDataURL(b); });
    const img = await new Promise<HTMLImageElement>((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = data; });
    return { data, w: img.width, h: img.height };
  } catch { return null; }
}

export async function buildInvoicePdf(d: InvoiceData): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18, R = W - M;
  const INK: [number, number, number] = [20, 33, 31], MUT: [number, number, number] = [107, 122, 119], JADE: [number, number, number] = [47, 125, 107], RED: [number, number, number] = [180, 68, 58];
  const color = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  let y = 22;

  const logo = await loadLogo();
  if (logo) {
    const lh = 30, lw = (lh * logo.w) / logo.h;
    doc.addImage(logo.data, "PNG", M, 9, lw, lh);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(MUT);
    doc.text(CLINIC.address, M, 43);
    if (CLINIC.phone) doc.text(CLINIC.phone, M, 48);
  } else {
    doc.setFont("times", "normal"); doc.setFontSize(26); color(INK); doc.text("Evergrace", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(MUT);
    doc.text(CLINIC.name, M, y + 6); doc.text(CLINIC.address, M, y + 11);
    if (CLINIC.phone) doc.text(CLINIC.phone, M, y + 16);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); color(INK);
  doc.text(`Invoice No: ${d.number}`, R, y + 2, { align: "right" });

  y += logo ? 33 : 22;
  doc.setFont("times", "normal"); doc.setFontSize(17); color(JADE);
  const tw = doc.getTextWidth("Invoice"), mid = W / 2;
  doc.setDrawColor(217, 224, 222); doc.line(M, y, mid - tw / 2 - 4, y); doc.line(mid + tw / 2 + 4, y, R, y);
  doc.text("Invoice", mid, y + 2, { align: "center" }); y += 11;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); color(INK); doc.text(d.patient.name, M, y);
  y += 5; doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); color(MUT); doc.text(d.patient.phone, M, y);
  y += 5; doc.text(d.date, M, y);

  y += 10;
  const hide = !!d.hideDiscount;
  const head = () => {
    doc.setFillColor(243, 245, 244); doc.rect(M, y, R - M, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); color(INK);
    doc.text("#", M + 2, y + 5.3); doc.text("DATE / TIME", M + 9, y + 5.3); doc.text("SERVICE", 70, y + 5.3);
    if (!hide) { doc.text("PRICE", 150, y + 5.3, { align: "right" }); doc.text("DISCOUNT", 171, y + 5.3, { align: "right" }); doc.text("AMOUNT", R - 2, y + 5.3, { align: "right" }); }
    y += 8;
  };
  head();
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  d.lines.forEach((l, i) => {
    const svc = doc.splitTextToSize(l.service, hide ? R - 72 : 78) as string[];
    const wh = doc.splitTextToSize(l.when, 58) as string[];
    const h = Math.max(svc.length, wh.length, 1) * 4.6 + 5;
    if (y + h > 262) { doc.addPage(); y = 20; head(); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); }
    color(INK);
    doc.text(String(i + 1), M + 2, y + 5.5); doc.text(wh, M + 9, y + 5.5); doc.text(svc, 70, y + 5.5);
    if (!hide) {
      doc.text(rs(l.price), 150, y + 5.5, { align: "right" });
      doc.text(l.discount ? `- ${rs(l.discount)}` : "-", 171, y + 5.5, { align: "right" });
      doc.text(rs(l.amount), R - 2, y + 5.5, { align: "right" });
    }
    y += h; doc.setDrawColor(230, 235, 233); doc.line(M, y, R, y);
  });

  const subtotal = d.lines.reduce((t, l) => t + l.price, 0);
  const extra = d.extraDiscount ?? 0;
  const discount = d.lines.reduce((t, l) => t + l.discount, 0) + extra;
  const total = Math.max(d.lines.reduce((t, l) => t + l.amount, 0) - extra, 0);
  const paid = d.payments.reduce((t, p) => t + p.amount, 0);
  const balance = Math.max(total - paid, 0);
  if (y > 225) { doc.addPage(); y = 20; }
  y += 9;
  const row = (label: string, val: string, bold = false, c: [number, number, number] = INK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(bold ? 11 : 9.5); color(c);
    doc.text(label, 128, y); doc.text(val, R - 2, y, { align: "right" }); y += bold ? 7.5 : 6;
  };
  const top = y;
  if (!hide) row("Subtotal", rs(subtotal));
  if (!hide && discount > 0) row("Discount", `- ${rs(discount)}`, false, JADE);
  row("Total payable", rs(total), true);
  row("Paid", rs(paid));
  row("Balance due", rs(balance), true, balance > 0 ? RED : JADE);

  const status = balance === 0 ? "PAID" : paid > 0 ? "PARTIALLY PAID" : "UNPAID";
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); color(balance === 0 ? JADE : RED); doc.text(status, M, top + 4);

  if (d.payments.length) {
    y += 6; if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); color(MUT); doc.text("PAYMENTS RECEIVED", M, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(INK);
    d.payments.forEach((p) => {
      if (y > 272) { doc.addPage(); y = 20; }
      doc.text(p.date, M, y); doc.text(p.method, 60, y); doc.text(rs(p.amount), 110, y, { align: "right" }); y += 5;
    });
  }

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(MUT);
  doc.setFont("helvetica", "bold"); color(RED);
  doc.text("Payments can't be refunded in any case.", W / 2, 279, { align: "center" });
  doc.setFont("helvetica", "normal"); color(MUT);
  doc.text(CLINIC.footer, W / 2, 285, { align: "center" });
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}