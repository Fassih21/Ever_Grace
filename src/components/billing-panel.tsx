import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { METHODS, chip, type Method } from "@/lib/shared";
import { money } from "@/lib/format";

export function BillingPanel(p: { id: string; total: number; discount: number; paid: number; defaultPrice: number }) {
  const qc = useQueryClient();
  const priced = p.total > 0;
  const [price, setPrice] = useState(priced ? String(p.total + p.discount) : p.defaultPrice ? String(p.defaultPrice) : "");
  const [disc, setDisc] = useState(p.discount ? String(p.discount) : "");
  const [pct, setPct] = useState(false);
  const [adv, setAdv] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const num = (v: string) => Number(v) || 0;
  const t = num(price);
  const d = Math.min(pct ? Math.round((t * num(disc)) / 100) : num(disc), t);
  const net = t - d;
  const a = num(adv);
  const pending = Math.max(net - p.paid - a, 0);
  const valid = t > 0 && net > 0 && net >= p.paid && p.paid + a <= net;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_appointment_billing", {
        p_appointment_id: p.id, p_price: t, p_discount: d, p_advance: a, ...(a > 0 ? { p_method: method } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Billing saved"); setAdv(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const lbl = "mb-1.5 mt-3 block text-sm text-muted-foreground";
  return (
    <div className="mb-5 rounded-2xl border bg-card p-4">
      <div className="text-sm font-semibold">{priced ? "Billing" : "Set price"}</div>
      <div className="grid grid-cols-2 gap-3">
        <div><span className={lbl}>Price (Rs)</span><Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} /></div>
        <div><span className={lbl}>Discount ({pct ? "%" : "Rs"})</span><Input inputMode="numeric" value={disc} onChange={(e) => setDisc(e.target.value.replace(/\D/g, ""))} /></div>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" className={chip(!pct)} onClick={() => { setPct(false); setDisc(""); }}>Rs</button>
        <button type="button" className={chip(pct)} onClick={() => { setPct(true); setDisc(""); }}>%</button>
      </div>
      <span className={lbl}>{priced ? "Receive now (Rs)" : "Advance (Rs)"}</span>
      <Input inputMode="numeric" value={adv} onChange={(e) => setAdv(e.target.value.replace(/\D/g, ""))} />
      {a > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {METHODS.map((m) => <button key={m.v} type="button" className={chip(method === m.v)} onClick={() => setMethod(m.v)}>{m.l}</button>)}
        </div>
      )}
      {t > 0 && net <= 0 && <p className="mt-1 text-xs text-[#b4443a]">Discount must be less than the price</p>}
      {net > 0 && p.paid + a > net && <p className="mt-1 text-xs text-[#b4443a]">Amount more than payable</p>}
      <div className="mt-4 flex justify-between rounded-lg bg-[#f7e1de] px-3 py-3 text-sm font-semibold text-[#b4443a]">
        <span>Pending</span><span>{money(pending)}</span>
      </div>
      <Button className="mt-4 w-full" disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save"}</Button>
    </div>
  );
}
