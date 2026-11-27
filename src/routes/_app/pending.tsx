import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceivePayment, type PayTarget } from "@/components/receive-payment";
import { fetchByIds, fetchPendingAppointments } from "@/lib/shared";
import { DEFAULTS, useAppSettings } from "@/lib/settings";
import { fmtDate, money } from "@/lib/format";

export const Route = createFileRoute("/_app/pending")({
  head: () => ({ meta: [{ title: "Pending · Evergrace Clinic" }] }),
  component: Pending,
});

function Pending() {
  const [pay, setPay] = useState<PayTarget | null>(null);
  const showNames = (useAppSettings().data ?? DEFAULTS).pending_show_names;
  const q = useQuery({
    queryKey: ["pending"],
    queryFn: async () => {
      const rows = await fetchPendingAppointments();
      const pts = await fetchByIds([...new Set(rows.map((r) => r.patient_id!))], (c) => supabase.from("patients").select("id,name").in("id", c));
      return rows.map((r) => ({ id: r.id!, date: r.appt_date!, due: r.balance!, name: pts.find((x) => x.id === r.patient_id)?.name ?? "—" }));
    },
  });
  const total = (q.data ?? []).reduce((t, r) => t + r.due, 0);
  return (
    <div className="max-w-2xl">
      <h1 className="serif text-2xl md:text-3xl">Pending</h1>
      <div className="mb-5 mt-1 text-3xl font-semibold text-[#b4443a]">{money(total)}</div>
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.length ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">Nothing pending.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          {q.data.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                {showNames && <div className="truncate font-semibold">{r.name}</div>}
                <div className="text-xs text-muted-foreground">{fmtDate(r.date, { day: "numeric", month: "short" })}</div>
              </div>
              <div className="font-semibold text-[#b4443a]">{money(r.due)}</div>
              <Button size="sm" variant="outline" onClick={() => setPay({ id: r.id, balance: r.due, who: r.name })}>Receive</Button>
            </div>
          ))}
        </div>
      )}
      <ReceivePayment target={pay} onClose={() => setPay(null)} />
    </div>
  );
}
