import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { BookForm } from "@/components/book-form";
import { InvoiceDialog, type InvoiceTarget } from "@/components/invoice-dialog";
import { ACTIVE, calcMaxDur, useDayAppts, useServices, useSlots } from "@/lib/shared";
import { addDays, fmtDate, fmtTime, money, todayPK } from "@/lib/format";

export const Route = createFileRoute("/_app/appointments")({
  head: () => ({ meta: [{ title: "Appointments · Evergrace Clinic" }] }),
  component: Appointments,
});

function Appointments() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const today = todayPK();
  const [date, setDate] = useState(today);
  const [sel, setSel] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [inv, setInv] = useState<InvoiceTarget | null>(null);
  const [reason, setReason] = useState("");
  const slots = useSlots().data ?? [];
  const services = useServices().data ?? [];
  const past = date < today;

  const day = useDayAppts(date);
  const stripStart = addDays(date, -2);
  const week = useQuery({
    queryKey: ["week", stripStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointment_balance").select("appt_date")
        .gte("appt_date", stripStart).lte("appt_date", addDays(stripStart, 6)).in("status", [...ACTIVE]);
      const m: Record<string, number> = {};
      (data ?? []).forEach((r) => (m[r.appt_date!] = (m[r.appt_date!] ?? 0) + 1));
      return m;
    },
  });

  const svcName = (id: string | null) => services.find((s) => s.id === id)?.name ?? "";
  const rows = day.data ?? [];
  const startAt = (order: number) => rows.find((r) => r.start_slot === order);
  const occupied = (order: number) =>
    rows.some((r) => order >= r.start_slot! && order < r.start_slot! + r.slots_count!);

  const maxDur = (start: number) => calcMaxDur(slots, rows, start);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["appts"] });
    qc.invalidateQueries({ queryKey: ["week"] });
  };
  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: "completed" | "cancelled"; reason?: string }) => {
      const { error } = await supabase
        .from("appointments").update({ status: v.status, cancel_reason: v.reason || null }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelAppt = rows.find((r) => r.id === cancelId);
  const selSlot = slots.find((s) => s.sort_order === sel);
  const form = selSlot && (
    <BookForm
      key={`${date}-${sel}`}
      date={date}
      start={selSlot.sort_order}
      label={`${fmtTime(selSlot.start_time)} – ${fmtTime(selSlot.end_time)}`}
      maxDur={maxDur(selSlot.sort_order)}
      slots={slots}
      services={services}
      onDone={() => {
        setSel(null);
        refresh();
      }}
    />
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="serif text-2xl md:text-3xl">Appointments</h1>
          <p className="text-sm text-muted-foreground">Pick a slot, choose the service, save. Cancelled slots open up again.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -1))}><ChevronLeft /></Button>
          <div className="rounded-md border bg-card px-3 py-2 text-sm font-semibold">
            {fmtDate(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))}><ChevronRight /></Button>
          <Button onClick={() => { setDate(today); setSel(null); }}>Today</Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => addDays(stripStart, i)).map((d) => (
          <button
            key={d}
            onClick={() => { setDate(d); setSel(null); }}
            className={cn("rounded-xl border px-1 py-2.5 text-center", d === date ? "border-[#14211f] bg-[#14211f] text-white" : "bg-card")}
          >
            <div className="text-[11px] opacity-70">{fmtDate(d, { weekday: "short" })}</div>
            <div className="text-lg font-semibold leading-tight">{Number(d.slice(8))}</div>
            <div className="text-[10px] opacity-70">{week.data?.[d] ?? 0} booked</div>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="self-start overflow-hidden rounded-2xl border bg-card">
          {day.isLoading || !slots.length ? (
            <div className="space-y-3 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            slots.map((s) => {
              const a = startAt(s.sort_order);
              if (!a && occupied(s.sort_order)) return null;
              const end = a ? slots.find((x) => x.sort_order === a.start_slot! + a.slots_count! - 1) ?? s : s;
              const time = `${fmtTime(s.start_time)} – ${fmtTime(end.end_time)}`;
              return (
                <div key={s.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3.5 last:border-b-0", sel === s.sort_order && "bg-[#f3f8f6]")}>
                  <div className="w-28 shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{time}</div>
                    <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      !a ? "border border-dashed text-muted-foreground" : a.status === "completed" ? "bg-[#e3f1ed] text-[#2f7d6b]" : "bg-[#fdf3dc] text-[#b7791f]")}>
                      {!a ? "Free" : a.status === "completed" ? "Completed" : "Booked"}
                    </span>
                  </div>
                  {a ? (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{a.patient}</div>
                        <div className="truncate text-sm text-muted-foreground">
                          {svcName(a.service_id)}{a.slots_count! > 1 ? ` · ${a.slots_count} slots` : ""}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold">{money(a.total_amount!)}</div>
                        {(a.discount_amount ?? 0) > 0 && <div className="text-xs text-muted-foreground">Discount {money(a.discount_amount!)}</div>}
                        {a.balance ? <div className="whitespace-nowrap text-[#b4443a]">Pending {money(a.balance)}</div> : <div className="text-[#2f7d6b]">Paid in full</div>}
                      </div>
                      {a.status === "completed" && <Button size="sm" variant="outline" onClick={() => setInv({ patientId: a.patient_id!, date: a.appt_date! })}>Invoice</Button>}
                      {a.status === "booked" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: a.id!, status: "completed" })}>Mark completed</Button>
                          <Button size="sm" variant="outline" className="border-[#e9b8b0] text-[#b4443a]" onClick={() => { setReason(""); setCancelId(a.id!); }}>Cancel</Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex-1 text-sm text-muted-foreground">{sel === s.sort_order ? "Selected for booking" : "Open slot"}</div>
                      {!past && <Button size="sm" onClick={() => setSel(s.sort_order)}>Book</Button>}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
        {!isMobile && (
          <div className="self-start rounded-2xl border bg-card p-5">
            {form ?? <p className="py-10 text-center text-sm text-muted-foreground">{past ? "Past dates can only be viewed." : "Select a free slot to book."}</p>}
          </div>
        )}
      </div>

      <Sheet open={!!isMobile && !!form} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-5 pb-8">
          <SheetHeader className="sr-only"><SheetTitle>Book slot</SheetTitle></SheetHeader>
          {form}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              The slot becomes free. The record stays in history.
              {(cancelAppt?.paid_total ?? 0) > 0 && ` ${money(cancelAppt!.paid_total!)} was already paid on this booking. If it is refunded, the owner must void that payment from the patient page.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelId && setStatus.mutate({ id: cancelId, status: "cancelled", reason })}>Cancel booking</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InvoiceDialog target={inv} onClose={() => setInv(null)} />
    </div>
  );
}