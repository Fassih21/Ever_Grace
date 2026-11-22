import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MakeInvoice, type InvTarget } from "@/components/make-invoice";
import { useDayAppts } from "@/lib/shared";
import { initials, todayPK } from "@/lib/format";

export const Route = createFileRoute("/_app/invoices")({
  head: () => ({ meta: [{ title: "Invoices · Evergrace Clinic" }] }),
  component: Invoices,
});

function Invoices() {
  const [inv, setInv] = useState<InvTarget | null>(null);
  const [find, setFind] = useState("");
  const term = find.trim().replace(/[%,()]/g, "");
  const today = useDayAppts(todayPK()).data ?? [];
  const found = useQuery({
    queryKey: ["inv-find", term],
    enabled: term.length >= 2,
    queryFn: async () => (await supabase.from("patients").select("id,name,phone").or(`name.ilike.%${term}%,phone.ilike.%${term}%`).limit(8)).data ?? [],
  });
  const list = term.length >= 2 ? (found.data ?? []).map((p) => ({ id: p.id, name: p.name, phone: p.phone })) : [];
  const todays = [...new Map(today.map((r) => [r.phone, { id: r.id!, name: r.patient!, phone: r.phone! }])).values()];
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
      <MakeInvoice target={inv} onClose={() => setInv(null)} />
    </div>
  );
}
