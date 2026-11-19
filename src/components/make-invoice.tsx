import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useServices } from "@/lib/shared";
import { buildInvoicePdf, downloadBlob } from "@/lib/invoice";
import { fmtDate, money, todayPK } from "@/lib/format";

export type InvTarget = { name: string; phone: string };
type Row = { name: string; price: string; qty: string };
const blank = (): Row => ({ name: "", price: "", qty: "1" });
const num = (v: string) => Math.max(Number(v) || 0, 0);

export function MakeInvoice({ target, onClose }: { target: InvTarget | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Make invoice</DialogTitle></DialogHeader>
        {target && <Form key={target.phone + target.name} target={target} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ target }: { target: InvTarget }) {
  const services = useServices().data ?? [];
  const [name, setName] = useState(target.name);
  const [phone, setPhone] = useState(target.phone);
  const [date, setDate] = useState(todayPK());
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [disc, setDisc] = useState("");
  const [pct, setPct] = useState(false);
  const [received, setReceived] = useState("");
  const [method, setMethod] = useState("Cash");
  const [busy, setBusy] = useState(false);

  const set = (i: number, k: keyof Row, v: string) =>
    setRows((r) => r.map((x, j) => {
      if (j !== i) return x;
      const n = { ...x, [k]: v };
      if (k === "name") { const s = services.find((s) => s.name === v); if (s && !x.price) n.price = String(s.default_price); }
      return n;
    }));

  const lines = rows.filter((r) => r.name.trim() && num(r.price) > 0);
  const subtotal = lines.reduce((t, r) => t + num(r.price) * (num(r.qty) || 1), 0);
  const discount = Math.min(pct ? Math.round((subtotal * num(disc)) / 100) : num(disc), subtotal);
  const total = subtotal - discount;
  const paid = Math.min(num(received), total);
  const balance = total - paid;

  async function run(print: boolean) {
    setBusy(true);
    try {
      if (!name.trim()) throw new Error("Enter patient name");
      if (!lines.length) throw new Error("Add at least one procedure with price");
      const number = `EVG-${date.replaceAll("-", "")}-${Date.now().toString().slice(-4)}`;
      const blob = await buildInvoicePdf({
        number, date: fmtDate(date, { day: "numeric", month: "long", year: "numeric" }),
        patient: { name: name.trim(), phone: phone.trim() }, extraDiscount: discount,
        lines: lines.map((r) => {
          const q = num(r.qty) || 1, a = num(r.price) * q;
          return { service: q > 1 ? `${r.name.trim()} x ${q}` : r.name.trim(), when: fmtDate(date, { day: "numeric", month: "short" }), price: a, discount: 0, amount: a };
        }),
        payments: paid > 0 ? [{ date: fmtDate(date, { day: "numeric", month: "short", year: "numeric" }), method, amount: paid }] : [],
      });
      if (print) window.open(URL.createObjectURL(blob), "_blank");
      else downloadBlob(blob, `Invoice-${number}-${name.trim().replace(/\s+/g, "-")}.pdf`);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-2">
        <datalist id="svc">{services.map((s) => <option key={s.id} value={s.name} />)}</datalist>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Input list="svc" className="min-w-0 flex-1" placeholder="Procedure" value={r.name} onChange={(e) => set(i, "name", e.target.value)} />
            <Input className="w-20" inputMode="numeric" placeholder="Price" value={r.price} onChange={(e) => set(i, "price", e.target.value)} />
            <Input className="w-12" inputMode="numeric" placeholder="Qty" value={r.qty} onChange={(e) => set(i, "qty", e.target.value)} />
            <Button variant="ghost" size="icon" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setRows([...rows, blank()])}><Plus /> Add procedure</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex gap-2">
          <Input inputMode="numeric" placeholder="Discount" value={disc} onChange={(e) => setDisc(e.target.value)} />
          <Button variant="outline" className="w-14" onClick={() => setPct(!pct)}>{pct ? "%" : "Rs"}</Button>
        </div>
        <div className="flex gap-2">
          <Input inputMode="numeric" placeholder="Received" value={received} onChange={(e) => setReceived(e.target.value)} />
          <select className="rounded-md border bg-background px-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>Cash</option><option>Card</option><option>Online</option>
          </select>
        </div>
      </div>
      <div className="space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(subtotal)}</span></div>
        {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- {money(discount)}</span></div>}
        <div className="flex justify-between font-semibold"><span>Total</span><span>{money(total)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span>{money(balance)}</span></div>
        <p className="pt-1 text-center text-xs font-semibold text-[#b4443a]">Payments can't be refunded in any case.</p>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy} onClick={() => run(false)}>Download PDF</Button>
        <Button className="flex-1" variant="outline" disabled={busy} onClick={() => run(true)}>Print</Button>
      </div>
    </div>
  );
}
