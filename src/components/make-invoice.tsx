import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { METHODS, useServices, type Method } from "@/lib/shared";
import { buildInvoicePdf, downloadBlob } from "@/lib/invoice";
import { fmtDate, money, normPhone, todayPK } from "@/lib/format";

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
  const [method, setMethod] = useState<Method>("cash");
  const [hideDisc, setHideDisc] = useState(true);
  const [apptId, setApptId] = useState<string | null>(null);
  const qc = useQueryClient();
  const appts = useQuery({
    queryKey: ["inv-appts", normPhone(target.phone)],
    queryFn: async () => {
      const { data: pt } = await supabase.from("patients").select("id").eq("phone", normPhone(target.phone)).maybeSingle();
      if (!pt) return [];
      const { data } = await supabase.from("appointment_balance").select("id,appt_date,service_id,total_amount,paid_total,status")
        .eq("patient_id", pt.id).in("status", ["booked", "completed", "on_hold"]).order("appt_date", { ascending: false });
      return data ?? [];
    },
  });
  const list = appts.data ?? [];
  const defId = (list.find((a) => a.appt_date === todayPK() && a.total_amount === 0) ?? list.find((a) => a.total_amount === 0))?.id ?? "";
  const sel = apptId ?? defId;
  const linked = list.find((a) => a.id === sel);
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
  const prevPaid = linked?.paid_total ?? 0;
  const balance = total - paid - prevPaid;

  async function run(print: boolean) {
    setBusy(true);
    try {
      if (!name.trim()) throw new Error("Enter patient name");
      if (!lines.length) throw new Error("Add at least one procedure with price");
      if (sel) {
        const { error } = await supabase.rpc("set_appointment_billing", { p_appointment_id: sel, p_price: subtotal, p_discount: discount, p_advance: paid, ...(paid > 0 ? { p_method: method } : {}) });
        if (error) throw error;
        qc.invalidateQueries();
      }
      const number = `EVG-${date.replaceAll("-", "")}-${Date.now().toString().slice(-4)}`;
      const blob = await buildInvoicePdf({
        number, date: fmtDate(date, { day: "numeric", month: "long", year: "numeric" }),
        patient: { name: name.trim(), phone: phone.trim() }, extraDiscount: discount, hideDiscount: hideDisc,
        lines: lines.map((r) => {
          const q = num(r.qty) || 1, a = num(r.price) * q;
          return { service: q > 1 ? `${r.name.trim()} x ${q}` : r.name.trim(), when: fmtDate(date, { day: "numeric", month: "short" }), price: a, discount: 0, amount: a };
        }),
        payments: paid > 0 ? [{ date: fmtDate(date, { day: "numeric", month: "short", year: "numeric" }), method: METHODS.find((m) => m.v === method)!.l, amount: paid }] : [],
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
      {list.length > 0 && (
        <select className="w-full rounded-md border bg-background px-2 py-2 text-sm" value={sel} onChange={(e) => setApptId(e.target.value)}>
          <option value="">Not linked (PDF only, pending won't update)</option>
          {list.map((a) => <option key={a.id!} value={a.id!}>{fmtDate(a.appt_date!, { day: "numeric", month: "short" })} · {services.find((x) => x.id === a.service_id)?.name}{a.total_amount ? ` · ${money(a.total_amount)}` : " · price not set"}</option>)}
        </select>
      )}
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
          <select className="rounded-md border bg-background px-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
            {METHODS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
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
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideDisc} onChange={(e) => setHideDisc(e.target.checked)} />Hide discount on invoice</label>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy} onClick={() => run(false)}>Download PDF</Button>
        <Button className="flex-1" variant="outline" disabled={busy} onClick={() => run(true)}>Print</Button>
      </div>
    </div>
  );
}
