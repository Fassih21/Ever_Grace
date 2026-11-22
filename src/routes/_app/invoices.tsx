import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MakeInvoice, type InvTarget } from "@/components/make-invoice";
import { toast } from "sonner";
import { METHODS, fetchByIds, useDayAppts } from "@/lib/shared";
import { buildInvoicePdf, downloadBlob } from "@/lib/invoice";
import { DEFAULTS, useAppSettings } from "@/lib/settings";
import { fmtDate, initials, money, todayPK } from "@/lib/format";

export const Route = createFileRoute("/_app/invoices")({
  head: () => ({ meta: [{ title: "Invoices · Evergrace Clinic" }] }),
  component: Invoices,
});

function Invoices() {
  const [inv, setInv] = useState<InvTarget | null>(null);
  const [find, setFind] = useState("");
  const term = find.trim().replace(/[%,()]/g, "");
  const today = useDayAppts(todayPK()).data ?? [];
  const hide = (useAppSettings().data ?? DEFAULTS).invoice_hide_discount;
  type W = { id: string; inv_date: string; total: number; discount: number; paid: number; method: string; items: { name: string; qty: number; price: number }[]; name: string; phone: string };
  const walk = useQuery({
    queryKey: ["walkin-all"],
    queryFn: async (): Promise<W[]> => {
      const { data } = await (supabase as any).from("walkin_invoices").select("id,patient_id,inv_date,total,discount,paid,method,items").order("created_at", { ascending: false }).limit(40);
      const rows = (data ?? []) as (Omit<W, "name" | "phone"> & { patient_id: string })[];
      const pts = await fetchByIds([...new Set(rows.map((r) => r.patient_id))], (c) => supabase.from("patients").select("id,name,phone").in("id", c));
      return rows.map((r) => ({ ...r, name: pts.find((p) => p.id === r.patient_id)?.name ?? "—", phone: pts.find((p) => p.id === r.patient_id)?.phone ?? "" }));
    },
  });
  async function reprint(w: W) {
    try {
      const d = fmtDate(w.inv_date, { day: "numeric", month: "long", year: "numeric" });
      const blob = await buildInvoicePdf({
        number: `EVG-${w.inv_date.replaceAll("-", "")}-${w.id.slice(0, 4).toUpperCase()}`, date: d, patient: { name: w.name, phone: w.phone }, extraDiscount: w.discount, hideDiscount: hide,
        lines: w.items.map((i) => ({ service: i.qty > 1 ? `${i.name} x ${i.qty}` : i.name, when: fmtDate(w.inv_date, { day: "numeric", month: "short" }), price: i.price * i.qty, discount: 0, amount: i.price * i.qty })),
        payments: [{ date: fmtDate(w.inv_date, { day: "numeric", month: "short", year: "numeric" }), method: METHODS.find((m) => m.v === w.method)?.l ?? w.method, amount: w.paid }],
      });
      downloadBlob(blob, `Invoice-${w.name.replace(/\s+/g, "-")}.pdf`);
    } catch (e) { toast.error((e as Error).message); }
  }
  const found = useQuery({
    queryKey: ["inv-find", term],
    enabled: term.length >= 2,
    queryFn: async () => (await supabase.from("patients").select("id,name,phone").or(`name.ilike.%${term}%,phone.ilike.%${term}%`).limit(8)).data ?? [],
  });
  const list = term.length >= 2 ? (found.data ?? []).map((p) => ({ id: p.id, name: p.name, phone: p.phone })) : [];
  const todays = [...new Map(today.map((r) => [r.phone, { id: r.id!, name: r.patient!, phone: r.phone! }])).values()];
  const cfg = useAppSettings().data ?? DEFAULTS;
  const saved = useQuery({
    queryKey: ["walkin-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("walkin_invoices").select("id,patient_id,inv_date,items,total,discount,paid,method").order("created_at", { ascending: false }).limit(30);
      const rows = (data ?? []) as { id: string; patient_id: string; inv_date: string; items: { name: string; qty: number; price: number }[]; total: number; discount: number; paid: number; method: string }[];
      const ids = [...new Set(rows.map((r) => r.patient_id))];
      const { data: pts } = ids.length ? await supabase.from("patients").select("id,name,phone").in("id", ids) : { data: [] };
      return rows.map((r) => ({ ...r, p: (pts ?? []).find((x) => x.id === r.patient_id) }));
    },
  });
  async function again(r: NonNullable<typeof saved.data>[number]) {
    try {
      const w = fmtDate(r.inv_date, { day: "numeric", month: "short" });
      const blob = await buildInvoicePdf({
        number: `EVG-${r.inv_date.replaceAll("-", "")}-${r.id.slice(0, 4)}`, date: fmtDate(r.inv_date, { day: "numeric", month: "long", year: "numeric" }),
        patient: { name: r.p?.name ?? "", phone: r.p?.phone ?? "" }, extraDiscount: r.discount, hideDiscount: cfg.invoice_hide_discount,
        lines: r.items.map((i) => ({ service: i.qty > 1 ? `${i.name} x ${i.qty}` : i.name, when: w, price: i.price * i.qty, discount: 0, amount: i.price * i.qty })),
        payments: [{ date: fmtDate(r.inv_date, { day: "numeric", month: "short", year: "numeric" }), method: METHODS.find((m) => m.v === r.method)?.l ?? r.method, amount: r.paid }],
      });
      downloadBlob(blob, `Invoice-${r.p?.name ?? "walk-in"}-${r.inv_date}.pdf`);
    } catch (e) { toast.error((e as Error).message); }
  }
  const row = (p: { id: string; name: string; phone: string }) => (
    <div key={p.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e3f1ed] text-xs font-semibold text-[#2f7d6b]">{initials(p.name)}</div>
      <div className="min-w-0 flex-1 text-sm"><div className="truncate font-semibold">{p.name}</div><div className="text-xs text-muted-foreground">{p.phone}</div></div>
      <Button size="sm" variant="outline" onClick={() => setInv({ name: p.name, phone: p.phone })}><FileText /> Invoice</Button>
    </div>
  );
  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h1 className="serif text-2xl md:text-3xl">Invoices</h1><p className="text-sm text-muted-foreground">Select a patient to make an invoice.</p></div>
        <Button onClick={() => setInv({ name: "", phone: "" })}><Plus /> New invoice</Button>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search name or phone" value={find} onChange={(e) => setFind(e.target.value)} />
      </div>
      {term.length >= 2 ? (
        <div className="overflow-hidden rounded-2xl border bg-card">{list.length ? list.map(row) : <p className="p-6 text-center text-sm text-muted-foreground">No patient found.</p>}</div>
      ) : (
        <>
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Today</div>
          <div className="overflow-hidden rounded-2xl border bg-card">{todays.length ? todays.map(row) : <p className="p-6 text-center text-sm text-muted-foreground">No appointments today.</p>}</div>
        </>
      )}
      {term.length < 2 && !!walk.data?.length && (
        <>
          <div className="mb-2 mt-6 text-xs font-semibold uppercase text-muted-foreground">Walk-in invoices</div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {walk.data.map((w) => (
              <div key={w.id} className="flex items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{w.name}</div><div className="text-xs text-muted-foreground">{fmtDate(w.inv_date, { day: "numeric", month: "short" })} · {w.items.map((i) => i.name).join(", ")}</div></div>
                <b>{money(w.total)}</b>
                <Button size="sm" variant="outline" onClick={() => reprint(w)}>Download</Button>
              </div>
            ))}
          </div>
        </>
      )}
      {!!saved.data?.length && term.length < 2 && (
        <>
          <div className="mb-2 mt-6 text-xs font-semibold uppercase text-muted-foreground">Saved walk-in invoices</div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {saved.data.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                <div className="w-16 text-muted-foreground">{fmtDate(r.inv_date, { day: "numeric", month: "short" })}</div>
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{r.p?.name ?? "—"}</div><div className="truncate text-xs text-muted-foreground">{r.items.map((i) => i.name).join(", ")}</div></div>
                <b>{money(r.total)}</b>
                <Button size="sm" variant="outline" onClick={() => again(r)}>Download</Button>
              </div>
            ))}
          </div>
        </>
      )}
      <MakeInvoice target={inv} onClose={() => setInv(null)} />
    </div>
  );
}
