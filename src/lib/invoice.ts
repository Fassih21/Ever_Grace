import { DEFAULTS, fetchSettings } from "./settings";

export type InvoiceLine = { service: string; when: string; price: number; discount: number; amount: number };
export type InvoicePayment = { date: string; method: string; amount: number };
export type InvoiceData = {
  number: string;
  date: string;
  time?: string;
  patient: { name: string; phone: string; gender?: string | null };
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
  type C = [number, number, number];
  const W = 210, M = 16, R = W - M;
  const INK: C = [20, 33, 31], MUT: C = [107, 122, 119], JADE: C = [47, 125, 107], RED: C = [180, 68, 58], LINE: C = [200, 210, 207];
  const color = (c: C) => doc.setTextColor(c[0], c[1], c[2]);
  const stroke = (c: C) => doc.setDrawColor(c[0], c[1], c[2]);
  const hide = d.hideDiscount ?? true;
  const cfg = await fetchSettings();
  const logo = await loadLogo();
  let y = 14;

  // ---- header: logo and clinic name left, contact right
  const lh = 30, lw = logo ? (lh * logo.w) / logo.h : 0;
  if (logo) doc.addImage(logo.data, "PNG", M, y, lw, lh);
  const nameX = logo ? M + lw + 4 : M;
  const contactWidth = 58;
  const clinicName = cfg.clinic_name?.trim() || DEFAULTS.clinic_name;
  doc.setFont("times", "bold"); doc.setFontSize(17); color(INK);
  const nameWidth = doc.getTextWidth(clinicName), maxNameWidth = R - contactWidth - nameX - 5;
  if (nameWidth > maxNameWidth) doc.setFontSize(17 * maxNameWidth / nameWidth);
  doc.text(clinicName, nameX, y + 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(MUT);
  doc.text("Skin Care Clinic", nameX, y + 19);

  const address = cfg.clinic_address?.trim();
  const addressLines: string[] = address ? doc.splitTextToSize(address, contactWidth) : [];
  const phone = cfg.clinic_phone?.trim() || DEFAULTS.clinic_phone;
  const email = cfg.clinic_email?.trim() || DEFAULTS.clinic_email;
  let contactY = y + 6;
  for (const line of [...addressLines, phone, email]) {
    doc.text(line, R, contactY, { align: "right" });
    contactY += 4.5;
  }

  // ---- title
  y = Math.max(y + 40, contactY + 4);
  doc.setFont("times", "normal"); doc.setFontSize(20); color(JADE);
  const tw = doc.getTextWidth("INVOICE"), mid = W / 2;
  stroke(LINE);
  doc.line(M, y, mid - tw / 2 - 5, y); doc.line(mid + tw / 2 + 5, y, R, y);
  doc.text("INVOICE", mid, y + 2.5, { align: "center" });
  y += 10;

  // ---- patient details
  doc.setFontSize(9.5); color(INK);
  const detail = (label: string, value: string) => {
    doc.setFont("helvetica", "bold"); doc.text(label, M, y);
    const x = M + doc.getTextWidth(label) + 2;
    doc.setFont("helvetica", "normal"); doc.text(value || "-", x, y);
    y += 5.5;
  };
  detail("Name:", d.patient.name);
  detail("Gender:", d.patient.gender?.trim().replace(/^./, (c) => c.toUpperCase()) ?? "");
  detail("Contact Number:", d.patient.phone);
  detail("Date and Time:", d.time ? `${d.date}, ${d.time}` : d.date);
  y += 4.5;

  // ---- table: Procedure Name | Qty | Price
  const head = () => {
    doc.setFillColor(243, 245, 244); doc.rect(M, y, R - M, 9, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); color(INK);
    doc.text("Procedure Name", M + 3, y + 6); doc.text("Qty", 140, y + 6, { align: "center" }); doc.text("Price", R - 3, y + 6, { align: "right" });
    y += 9;
  };
  head();
  d.lines.forEach((l) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    const svc = doc.splitTextToSize(l.service, 100) as string[];
    const h = svc.length * 5.5 + 6;
    if (y + h > 225) { doc.addPage(); y = 20; head(); }
    color(INK);
    doc.text(svc, M + 3, y + 6.5);
    doc.text("1", 140, y + 6.5, { align: "center" });
    doc.text(rs(hide ? l.amount : l.price), R - 3, y + 6.5, { align: "right" });
    y += h; stroke(LINE); doc.line(M, y, R, y);
  });

  // ---- totals
  const subtotal = d.lines.reduce((t, l) => t + l.price, 0);
  const extra = d.extraDiscount ?? 0;
  const discount = d.lines.reduce((t, l) => t + l.discount, 0) + extra;
  const total = Math.max(d.lines.reduce((t, l) => t + l.amount, 0) - extra, 0);
  const paid = d.payments.reduce((t, p) => t + p.amount, 0);
  const balance = Math.max(total - paid, 0);
  const received = balance === 0 && paid > 0;

  if (y > 215) { doc.addPage(); y = 20; }
  y += 10;
  const top = y;
  const row = (label: string, val: string, bold = false, c: C = INK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(bold ? 12 : 10.5); color(c);
    doc.text(label, 120, y); doc.text(val, R - 3, y, { align: "right" }); y += bold ? 8 : 6.5;
  };
  if (!hide) { row("Total Amount", rs(subtotal)); if (discount > 0) row("Discount", `- ${rs(discount)}`, false, JADE); }
  row("Payable Amount", rs(total), true);
  if (!received) { row("Paid", rs(paid)); row("Balance due", rs(balance), true, RED); }

  // ---- Received tick + method (left side)
  stroke(INK); doc.setLineWidth(0.3); doc.rect(M, top - 4, 5, 5);
  if (received) { doc.setLineWidth(0.7); doc.line(M + 1, top - 1.4, M + 2.2, top - 0.2); doc.line(M + 2.2, top - 0.2, M + 4.2, top - 3); }
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); color(INK); doc.text("Received", M + 8, top);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  if (received) { color(MUT); doc.text([...new Set(d.payments.map((p) => p.method))].join(" / "), M + 8, top + 6); }
  else { color(RED); doc.text(paid > 0 ? "PARTIALLY PAID" : "UNPAID", M + 8, top + 6); }

  if (d.payments.length > 1 || (!received && d.payments.length)) {
    y += 6; if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); color(MUT); doc.text("PAYMENTS RECEIVED", M, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); color(INK);
    d.payments.forEach((p) => {
      if (y > 272) { doc.addPage(); y = 20; }
      doc.text(p.date, M, y); doc.text(p.method, 60, y); doc.text(rs(p.amount), 110, y, { align: "right" }); y += 5;
    });
  }

  // ---- footer
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); color(RED);
  doc.text("Payments can't be refunded in any case.", W / 2, 278, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); color(MUT);
  doc.text(cfg.invoice_footer, W / 2, 285, { align: "center" });
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
