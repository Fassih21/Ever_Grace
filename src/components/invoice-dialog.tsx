import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { buildInvoicePdf, downloadBlob } from "@/lib/invoice";
import { fmtDate, fmtTime, money } from "@/lib/format";

export type InvoiceTarget = { patientId: string; date: string };

export function InvoiceDialog({ target, onClose }: { target: InvoiceTarget | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Invoice</DialogTitle></DialogHeader>
        {target && <Inner key={target.patientId + target.date} target={target} />}
      </DialogContent>
    </Dialog>
  );
}

function Inner({ target }: { target: InvoiceTarget }) {
  const { patientId, date } = target;
  const [off, setOff] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["invoice-src", patientId, date],
    queryFn: async () => {
      const [p, a, sv, sl] = await Promise.all([
        supabase.from("patients").select("name,phone").eq("id", patientId).maybeSingle(),
        supabase.from("appointment_balance").select("*").eq("patient_id", patientId).eq("appt_date", date).eq("status", "completed").order("start_slot"),
        supabase.from("services").select("id,name"),
        supabase.from("slots").select("sort_order,start_time,end_time"),
      ]);
      const ids = (a.data ?? []).map((x) => x.id!);
      const pay = ids.length
        ? await supabase.from("payments").select("appointment_id,amount,method,paid_at").in("appointment_id", ids).eq("voided", false).order("paid_at")
        : { data: [] };
      return { p: p.data, a: a.data ?? [], sv: sv.data ?? [], sl: sl.data ?? [], pay: pay.data ?? [] };
    },
  });

  const d = q.data;
  const rows = (d?.a ?? []).filter((x) => !off.includes(x.id!));
  const when = (start: number, count: number) => {
    const s = d?.sl.find((x) => x.sort_order === start);
    const e = d?.sl.find((x) => x.sort_order === start + count - 1);
    return s && e ? `${fmtTime(s.start_time)} - ${fmtTime(e.end_time)}` : "";
  };
  const total = rows.reduce((t, x) => t + x.total_amount!, 0);
  const paid = rows.reduce((t, x) => t + (x.paid_total ?? 0), 0);
  const canShare = typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare;

  async function make() {
    const { data: no, error } = await supabase.rpc("get_or_create_invoice", { p_patient_id: patientId, p_date: date });
    if (error) throw error;
    const number = `EVG-${date.slice(0, 4)}-${String(no).padStart(4, "0")}`;
    const ids = rows.map((x) => x.id!);
    const blob = await buildInvoicePdf({
      number,
      date: fmtDate(date, { day: "numeric", month: "long", year: "numeric" }),
      patient: { name: d!.p?.name ?? "", phone: d!.p?.phone ?? "" },
      lines: rows.map((x) => ({
        service: d!.sv.find((s) => s.id === x.service_id)?.name ?? "Service",
        when: `${fmtDate(x.appt_date!, { day: "numeric", month: "short" })}, ${when(x.start_slot!, x.slots_count!)}`,
        price: x.total_amount! + (x.discount_amount ?? 0), discount: x.discount_amount ?? 0, amount: x.total_amount!,
      })),
      payments: d!.pay.filter((p) => ids.includes(p.appointment_id)).map((p) => ({
        date: fmtDate(new Date(p.paid_at).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }), { day: "numeric", month: "short", year: "numeric" }),
        method: p.method.replace("_", " ").replace(/^./, (c: string) => c.toUpperCase()), amount: p.amount,
      })),
    });
    return { blob, name: `Invoice-${number}-${(d!.p?.name ?? "patient").replace(/\s+/g, "-")}.pdf` };
  }
  async function run(share: boolean) {
    setBusy(true);
    try {
      const { blob, name } = await make();
      const file = new File([blob], name, { type: "application/pdf" });
      if (share && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: name });
      else downloadBlob(blob, name);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message || "Could not create the invoice");
    }
    setBusy(false);
  }

  if (q.isLoading) return <Skeleton className="h-40" />;
  if (!d?.a.length) return <p className="text-sm text-muted-foreground">No completed services for this patient on this date.</p>;
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground"><b className="text-foreground">{d.p?.name}</b> · {d.p?.phone} · {fmtDate(date, { day: "numeric", month: "short", year: "numeric" })}</div>
      <div className="overflow-hidden rounded-xl border">
        {d.a.map((x) => (
          <label key={x.id!} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 text-sm last:border-b-0">
            <input type="checkbox" className="size-4 accent-[#2f7d6b]" checked={!off.includes(x.id!)} onChange={(e) => setOff(e.target.checked ? off.filter((i) => i !== x.id) : [...off, x.id!])} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{d.sv.find((s) => s.id === x.service_id)?.name}</div>
              <div className="text-xs text-muted-foreground">{when(x.start_slot!, x.slots_count!)}{(x.discount_amount ?? 0) > 0 ? ` · discount ${money(x.discount_amount!)}` : ""}</div>
            </div>
            <b>{money(x.total_amount!)}</b>
          </label>
        ))}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Total payable</span><b>{money(total)}</b></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{money(paid)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Balance due</span><b className={total - paid > 0 ? "text-[#b4443a]" : "text-[#2f7d6b]"}>{money(Math.max(total - paid, 0))}</b></div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!rows.length || busy} onClick={() => run(false)}>{busy ? "Creating…" : "Download PDF"}</Button>
        {canShare && <Button className="flex-1" variant="outline" disabled={!rows.length || busy} onClick={() => run(true)}>Share</Button>}
      </div>
    </div>
  );
}
