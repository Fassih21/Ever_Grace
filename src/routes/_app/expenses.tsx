import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/lib/auth";
import { METHODS, chip, type Method } from "@/lib/shared";
import { fmtDate, monthRange, money, todayPK } from "@/lib/format";

export const Route = createFileRoute("/_app/expenses")({
  head: () => ({ meta: [{ title: "Expenses · Evergrace Clinic" }] }),
  component: Expenses,
});

const CATS = ["Rent", "Utilities", "Stock / Products", "Staff", "Maintenance", "Misc"];
const lbl = "mb-1.5 mt-4 block text-sm text-muted-foreground";

function Expenses() {
  const qc = useQueryClient();
  const owner = useMe().data?.role === "owner";
  const [month, setMonth] = useState(todayPK().slice(0, 7));
  const [f, setF] = useState({ cat: "", amount: "", method: "cash" as Method, date: todayPK(), note: "" });
  const amt = Number(f.amount) || 0;

  const list = useQuery({
    queryKey: ["expenses", month],
    enabled: owner,
    queryFn: async () => {
      const r = monthRange(month);
      return (await supabase.from("expenses").select("*").gte("spent_on", r.start).lte("spent_on", r.end).order("spent_on", { ascending: false })).data ?? [];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({ category: f.cat.trim(), amount: amt, method: f.method, spent_on: f.date, note: f.note.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Expense added"); setF({ ...f, cat: "", amount: "", note: "" }); qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["dash"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const total = (list.data ?? []).reduce((t, e) => t + e.amount, 0);

  return (
    <div>
      <h1 className="serif text-2xl md:text-3xl">Expenses</h1>
      <p className="text-sm text-muted-foreground">{owner ? "Add and review clinic expenses." : "Add expenses. The owner reviews the list."}</p>
      <div className="mt-5 grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="self-start rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Add expense</h2>
          <span className={lbl}>Category</span>
          <div className="mb-2 flex flex-wrap gap-2">{CATS.map((c) => <button key={c} type="button" className={chip(f.cat === c)} onClick={() => setF({ ...f, cat: c })}>{c}</button>)}</div>
          <Input placeholder="or type a category" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <div><span className={lbl}>Amount (Rs)</span><Input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, "") })} /></div>
            <div><span className={lbl}>Date</span><Input type="date" max={todayPK()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          </div>
          <span className={lbl}>Paid by</span>
          <div className="flex flex-wrap gap-2">{METHODS.map((m) => <button key={m.v} type="button" className={chip(f.method === m.v)} onClick={() => setF({ ...f, method: m.v })}>{m.l}</button>)}</div>
          <span className={lbl}>Note (optional)</span>
          <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <Button className="mt-5 w-full" disabled={!f.cat.trim() || amt <= 0 || !f.date || save.isPending} onClick={() => save.mutate()}>Save expense</Button>
        </div>
        {owner && (
          <div className="self-start overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <Input type="month" className="w-44" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
              <div className="text-sm font-semibold">Total {money(total)}</div>
            </div>
            {!list.data?.length ? <p className="p-10 text-center text-sm text-muted-foreground">No expenses this month.</p> : list.data.map((e) => (
              <div key={e.id} className="flex items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                <div className="w-20 text-muted-foreground">{fmtDate(e.spent_on, { day: "numeric", month: "short" })}</div>
                <div className="min-w-0 flex-1"><div className="font-medium">{e.category}</div>{e.note && <div className="truncate text-xs text-muted-foreground">{e.note}</div>}</div>
                <div className="text-xs capitalize text-muted-foreground">{e.method.replace("_", " ")}</div>
                <div className="w-24 text-right font-semibold">{money(e.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
