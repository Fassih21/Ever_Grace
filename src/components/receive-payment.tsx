import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { METHODS, chip, type Method } from "@/lib/shared";
import { money } from "@/lib/format";

export type PayTarget = { id: string; balance: number; who: string };

export function ReceivePayment({ target, onClose }: { target: PayTarget | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Receive payment</DialogTitle></DialogHeader>
        {target && <Inner key={target.id} target={target} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Inner({ target, onClose }: { target: PayTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(target.balance));
  const [method, setMethod] = useState<Method>("cash");
  const amt = Number(amount) || 0;
  const ok = amt > 0 && amt <= target.balance;
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("receive_appointment_payment", { p_appointment_id: target.id, p_amount: amt, p_method: method });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Payment saved");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">{target.who} · pending <b className="text-[#b4443a]">{money(target.balance)}</b></div>
      <div>
        <span className="mb-1.5 block text-sm text-muted-foreground">Amount (Rs)</span>
        <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        {amt > target.balance && <p className="mt-1 text-xs text-[#b4443a]">More than the pending amount</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {METHODS.map((m) => <button key={m.v} type="button" className={chip(method === m.v)} onClick={() => setMethod(m.v)}>{m.l}</button>)}
      </div>
      <Button className="w-full" disabled={!ok || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save payment"}</Button>
    </div>
  );
}
