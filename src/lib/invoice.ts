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
};

const rs = (n: number) => `Rs ${n.toLocaleString("en-US")}`;

export async function buildInvoicePdf(d: InvoiceData): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18, R = W - M;
  const INK: [number, number, number] = [20, 33, 31], MUT: [number, number, number] = [107, 122, 119], JADE: [number, number, number] = [47, 125, 107], RED: [number, number, number] = [180, 68, 58];
  const color = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  let y = 22;

  doc.setFont("times", "normal"); doc.setFontSize(26); color(INK); doc.text("Evergrace", M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(MUT);
  doc.text(CLINIC.name, M, y + 6); doc.text(CLINIC.address, M, y + 11);
  if (CLINIC.phone) doc.text(CLINIC.phone, M, y + 16);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); color(JADE); doc.text("INVOICE", R, y, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); color(INK);
  doc.text(`Invoice No: ${d.number}`, R, y + 7, { align: "right" });
  doc.text(`Date: ${d.date}`, R, y + 12, { align: "right" });

  y += 28;
  doc.setDrawColor(217, 224, 222); doc.line(M, y, R, y); y += 8;
  doc.setFontSize(8.5); color(MUT); doc.text("BILL TO", M, y);
  y += 5.5; doc.setFont("helvetica", "bold"); doc.setFontSize(11); color(INK); doc.text(d.patient.name, M, y);
  y += 5; doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); color(MUT); doc.text(d.patient.phone, M, y);

  y += 10;
  const head = () => {
    doc.setFillColor(243, 245, 244); doc.rect(M, y, R - M, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); color(INK);
    doc.text("#", M + 2, y + 5.3); doc.text("SERVICE", M + 9, y + 5.3); doc.text("DATE / TIME", 84, y + 5.3);
    doc.text("PRICE", 150, y + 5.3, { align: "right" }); doc.text("DISCOUNT", 171, y + 5.3, { align: "right" }); doc.text("AMOUNT", R - 2, y + 5.3, { align: "right" });
    y += 8;
  };
  head();
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  d.lines.forEach((l, i) => {
    const svc = doc.splitTextToSize(l.service, 56) as string[];
    const h = Math.max(svc.length, 1) * 4.6 + 5;
    if (y + h > 262) { doc.addPage(); y = 20; head(); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); }
    color(INK);
    doc.text(String(i + 1), M + 2, y + 5.5); doc.text(svc, M + 9, y + 5.5); doc.text(l.when, 84, y + 5.5);
    doc.text(rs(l.price), 150, y + 5.5, { align: "right" });
    doc.text(l.discount ? `- ${rs(l.discount)}` : "-", 171, y + 5.5, { align: "right" });
    doc.text(rs(l.amount), R - 2, y + 5.5, { align: "right" });
    y += h; doc.setDrawColor(230, 235, 233); doc.line(M, y, R, y);
  });

  const subtotal = d.lines.reduce((t, l) => t + l.price, 0);
  const discount = d.lines.reduce((t, l) => t + l.discount, 0);
  const total = d.lines.reduce((t, l) => t + l.amount, 0);
  const paid = d.payments.reduce((t, p) => t + p.amount, 0);
  const balance = Math.max(total - paid, 0);
  if (y > 225) { doc.addPage(); y = 20; }
  y += 9;
  const row = (label: string, val: string, bold = false, c: [number, number, number] = INK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(bold ? 11 : 9.5); color(c);
    doc.text(label, 128, y); doc.text(val, R - 2, y, { align: "right" }); y += bold ? 7.5 : 6;
  };
  const top = y;
  row("Subtotal", rs(subtotal));
  if (discount > 0) row("Discount", `- ${rs(discount)}`, false, JADE);
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
  doc.text(CLINIC.footer, W / 2, 285, { align: "center" });
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
