import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDayAppts, useSvcLabel } from "@/lib/shared";
import { fmtTime, initials, todayPK } from "@/lib/format";

export const STAGES = [
  { k: "registered", label: "Patient registration" },
  { k: "front_desk", label: "Front Desk", from: "registered", act: "Check in" },
  { k: "received", label: "Received sample", from: "front_desk", act: "Mark received" },
  { k: "conducted", label: "Conduct", from: "received", act: "Mark conducted" },
  { k: "approved", label: "Approve", from: "conducted", act: "Approve" },
] as const;
export type StageKey = (typeof STAGES)[number]["k"];

export function useStages() {
  const today = todayPK();
  return useQuery({
    queryKey: ["stages", today],
    queryFn: async () => {
      const { data } = await (supabase as any).from("appointments").select("id,stage").eq("appt_date", today);
      return new Map<string, string>((data ?? []).map((r: { id: string; stage: string }) => [r.id, r.stage]));
    },
  });
}

export function StageQueue({ stage, onClose }: { stage: StageKey | null; onClose: () => void }) {
  const today = todayPK();
  const qc = useQueryClient();
  const rows = useDayAppts(today).data ?? [];
  const stages = useStages().data;
  const label = useSvcLabel();
  const st = STAGES.find((s) => s.k === stage);
  const set = useMutation({
    mutationFn: async (v: { id: string; stage: string }) => {
      const { error } = await (supabase as any).rpc("set_appointment_stage", { p_appointment_id: v.id, p_stage: v.stage });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stages"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const at = (k: string) => rows.filter((r) => (stages?.get(r.id!) ?? "registered") === k).sort((a, b) => a.start_slot! - b.start_slot!);
  const item = (r: (typeof rows)[number], btn: React.ReactNode) => (
    <div key={r.id} className="flex items-center gap-3 border-b px-1 py-3 last:border-b-0">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e3f1ed] text-xs font-semibold text-[#2f7d6b]">{initials(r.patient)}</div>
      <div className="min-w-0 flex-1 text-sm">
        <div className="truncate font-semibold">{r.patient}</div>
        <div className="truncate text-xs text-muted-foreground">{label(r.id, r.service_id)} · {r.phone}</div>
      </div>
      {btn}
    </div>
  );
  const todo = st && "from" in st ? at(st.from) : [];
  const done = st && "from" in st ? at(st.k) : [];
  return (
    <Sheet open={!!st && "from" in st} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>{st?.label} · Today</SheetTitle></SheetHeader>
        {st && "from" in st && (
          <div className="px-4 pb-6">
            {todo.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No patients waiting.</p>}
            {todo.map((r) => item(r, <Button size="sm" disabled={set.isPending} onClick={() => set.mutate({ id: r.id!, stage: st.k })}>{st.act}</Button>))}
            {done.length > 0 && (
              <>
                <div className="mb-1 mt-6 text-xs font-semibold uppercase text-muted-foreground">Done ({done.length})</div>
                {done.map((r) => item(r, <Button size="sm" variant="ghost" disabled={set.isPending} onClick={() => set.mutate({ id: r.id!, stage: st.from })}>Undo</Button>))}
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}