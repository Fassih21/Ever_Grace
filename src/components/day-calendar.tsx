import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACTIVE } from "@/lib/shared";
import { addDays, monthRange, todayPK } from "@/lib/format";
import { cn } from "@/lib/utils";

const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d);
};
const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Booking count per day between start..end (both "YYYY-MM-DD"). */
function useBookingCounts(key: unknown[], start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("appointment_balance")
        .select("appt_date")
        .gte("appt_date", start)
        .lte("appt_date", end)
        .in("status", [...ACTIVE]);
      const counts = new Map<string, number>();
      (data ?? []).forEach((r) => {
        if (r.appt_date) counts.set(r.appt_date, (counts.get(r.appt_date) ?? 0) + 1);
      });
      return counts;
    },
  });
}

/**
 * Compact week strip + month popover.
 * `value` / `onSelect` use "YYYY-MM-DD". Days with bookings show 1–3 dots.
 */
export function DayCalendar({ value, onSelect }: { value: string; onSelect: (d: string) => void }) {
  const today = todayPK();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(toDate(value));

  // Week runs Monday → Sunday
  const weekStart = addDays(value, -((toDate(value).getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const week = useBookingCounts(["week", "strip", weekStart], weekStart, days[6]!);

  const ym = format(month, "yyyy-MM");
  const range = monthRange(ym);
  const monthQ = useBookingCounts(["week", "month", ym], range.start, range.end, open);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{format(toDate(value), "MMMM yyyy")}</div>
        <div className="flex items-center gap-1.5">
          {value !== today && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-[#2f7d6b]" onClick={() => onSelect(today)}>
              Today
            </Button>
          )}
          <Button variant="outline" size="icon" className="size-8" aria-label="Previous week" onClick={() => onSelect(addDays(value, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" aria-label="Next week" onClick={() => onSelect(addDays(value, 7))}>
            <ChevronRight className="size-4" />
          </Button>
          <Popover
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (o) setMonth(toDate(value));
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="size-8" aria-label="Open month calendar">
                <CalendarDays className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-2">
              <Calendar
                mode="single"
                weekStartsOn={1}
                selected={toDate(value)}
                month={month}
                onMonthChange={setMonth}
                onSelect={(d) => {
                  if (!d) return;
                  onSelect(iso(d));
                  setOpen(false);
                }}
                modifiers={{ booked: (d) => !!monthQ.data?.has(iso(d)) }}
                modifiersClassNames={{
                  booked:
                    "after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-[#2f7d6b]",
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const dt = toDate(d);
          const selected = d === value;
          const isToday = d === today;
          const n = Math.min(week.data?.get(d) ?? 0, 3);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={selected}
              aria-label={format(dt, "EEEE, d MMMM yyyy")}
              onClick={() => onSelect(d)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl border py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7d6b]/50",
                selected
                  ? "border-[#2f7d6b] bg-[#2f7d6b] text-white shadow-sm"
                  : "border-transparent hover:bg-[#eef1f0]",
                isToday && !selected && "border-[#2f7d6b]/40 bg-[#f3f8f6]",
              )}
            >
              <span className={cn("text-[10px] font-medium uppercase tracking-wide", selected ? "text-white/80" : "text-muted-foreground")}>
                {format(dt, "EEE")}
              </span>
              <span className="serif text-lg leading-none tabular-nums md:text-xl">{format(dt, "d")}</span>
              <span className="mt-0.5 flex h-1.5 items-center gap-0.5" aria-hidden>
                {Array.from({ length: n }).map((_, i) => (
                  <span key={i} className={cn("size-1 rounded-full", selected ? "bg-white" : "bg-[#2f7d6b]")} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}