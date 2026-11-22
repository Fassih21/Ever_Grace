import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Clock, FileText, SlidersHorizontal, Sparkles, UserCog, Users as UsersIcon, Wallet } from "lucide-react";
import { OwnerOnly } from "@/components/owner-only";
import { createManager, setUserActive } from "@/lib/users.functions";
import { fmtTime } from "@/lib/format";
import { DEFAULTS, useAppSettings, useSaveSettings } from "@/lib/settings";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings · Evergrace Clinic" }] }),
  component: () => <OwnerOnly><Settings /></OwnerOnly>,
});

const box = "flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0";
const lbl = "text-xs text-muted-foreground";

const SECTIONS = [
  { k: "services", t: "Services", d: "Treatments, prices and default slots", i: Sparkles },
  { k: "slots", t: "Slots", d: "Clinic timings and breaks", i: Clock },
  { k: "users", t: "Users", d: "Managers and access", i: UserCog },
  { k: "invoice", t: "Invoice", d: "Clinic name, address, footer, discount", i: FileText },
  { k: "display", t: "Display", d: "Pending page and menu items", i: SlidersHorizontal },
] as const;
const LINKS = [
  { to: "/staff", t: "Staff", d: "Attendance and salaries", i: UsersIcon },
  { to: "/expenses", t: "Expenses", d: "Clinic expenses", i: Wallet },
] as const;
const row = "flex w-full items-center gap-3 border-b px-4 py-4 text-left last:border-b-0 hover:bg-accent";

function Settings() {
  const [view, setView] = useState<string | null>(null);
  const sec = SECTIONS.find((x) => x.k === view);
  if (sec) {
    return (
      <div>
        <button className="mb-3 flex items-center gap-1 text-sm text-muted-foreground" onClick={() => setView(null)}><ChevronLeft className="size-4" />Settings</button>
        <h1 className="serif mb-1 text-2xl md:text-3xl">{sec.t}</h1>
        <p className="text-sm text-muted-foreground">{sec.d}</p>
        {view === "services" && <Services />}
        {view === "slots" && <Slots />}
        {view === "users" && <Users />}
        {view === "invoice" && <InvoiceSettings />}
        {view === "display" && <DisplaySettings />}
      </div>
    );
  }
  const inner = (x: { t: string; d: string; i: typeof Clock }) => (
    <>
      <span className="grid size-10 place-items-center rounded-xl bg-[#e3f1ed] text-[#2f7d6b]"><x.i className="size-5" /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold">{x.t}</span><span className="block text-xs text-muted-foreground">{x.d}</span></span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </>
  );
  return (
    <div className="max-w-2xl">
      <h1 className="serif text-2xl md:text-3xl">Settings</h1>
      <p className="mb-5 text-sm text-muted-foreground">Manage your clinic.</p>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {SECTIONS.map((x) => <button key={x.k} className={row} onClick={() => setView(x.k)}>{inner(x)}</button>)}
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
        {LINKS.map((x) => <Link key={x.to} to={x.to} className={row}>{inner(x)}</Link>)}
      </div>
    </div>
  );
}

function useSave(table: "services" | "slots") {
  const qc = useQueryClient();
  return {
    done: () => { qc.invalidateQueries({ queryKey: [table] }); qc.invalidateQueries({ queryKey: [`${table}-all`] }); toast.success("Saved"); },
    fail: (e: { message: string }) => toast.error(e.message),
  };
}

function Services() {
  const { done, fail } = useSave("services");
  const q = useQuery({ queryKey: ["services-all"], queryFn: async () => (await supabase.from("services").select("*").order("name")).data ?? [] });
  const [n, setN] = useState({ name: "", price: "", slots: "1" });
  const [find, setFind] = useState("");
  return (
    <div className="mt-4">
    <Input className="mb-3" placeholder="Search service…" value={find} onChange={(e) => setFind(e.target.value)} />
    <div className="overflow-hidden rounded-2xl border bg-card">
      {(q.data ?? []).filter((s) => s.name.toLowerCase().includes(find.toLowerCase())).map((s) => <ServiceRow key={s.id + s.updated_at} s={s} onDone={done} onFail={fail} />)}
      <div className={box + " bg-[#f7f9f8]"}>
        <div className="min-w-[160px] flex-1"><div className={lbl}>New service</div><Input value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} placeholder="e.g. Microneedling" /></div>
        <div className="w-28"><div className={lbl}>Price (Rs)</div><Input inputMode="numeric" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value.replace(/\D/g, "") })} /></div>
        <div className="w-24"><div className={lbl}>Slots</div><Input inputMode="numeric" value={n.slots} onChange={(e) => setN({ ...n, slots: e.target.value.replace(/\D/g, "") })} /></div>
        <Button className="self-end" disabled={!n.name.trim() || ![1, 2, 3].includes(Number(n.slots))} onClick={async () => {
          const { error } = await supabase.from("services").insert({ name: n.name.trim(), default_price: Number(n.price) || 0, default_slots: Number(n.slots) });
          if (error) { fail(error); return; }
          setN({ name: "", price: "", slots: "1" }); done();
        }}>Add</Button>
      </div>
    </div>
    </div>
  );
}

function ServiceRow({ s, onDone, onFail }: { s: { id: string; name: string; default_price: number; default_slots: number; active: boolean }; onDone: () => void; onFail: (e: { message: string }) => void }) {
  const [v, setV] = useState({ name: s.name, price: String(s.default_price), slots: String(s.default_slots), active: s.active });
  const ok = v.name.trim() && [1, 2, 3].includes(Number(v.slots));
  return (
    <div className={box}>
      <div className="min-w-[160px] flex-1"><div className={lbl}>Name</div><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <div className="w-28"><div className={lbl}>Price (Rs)</div><Input inputMode="numeric" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value.replace(/\D/g, "") })} /></div>
      <div className="w-24"><div className={lbl}>Slots</div><Input inputMode="numeric" value={v.slots} onChange={(e) => setV({ ...v, slots: e.target.value.replace(/\D/g, "") })} /></div>
      <div className="flex items-center gap-2 self-end pb-2 text-sm"><Switch checked={v.active} onCheckedChange={(a) => setV({ ...v, active: a })} />Active</div>
      <Button className="self-end" variant="outline" disabled={!ok} onClick={async () => {
        const { error } = await supabase.from("services").update({ name: v.name.trim(), default_price: Number(v.price) || 0, default_slots: Number(v.slots), active: v.active }).eq("id", s.id);
        error ? onFail(error) : onDone();
      }}>Save</Button>
    </div>
  );
}

function Slots() {
  const { done, fail } = useSave("slots");
  const q = useQuery({ queryKey: ["slots-all"], queryFn: async () => (await supabase.from("slots").select("*").order("sort_order")).data ?? [] });
  const [n, setN] = useState({ s: "", e: "" });
  const next = Math.max(0, ...(q.data ?? []).map((x) => x.sort_order)) + 1;
  const lab = (s: string, e: string) => `${fmtTime(s)} – ${fmtTime(e)}`;
  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-muted-foreground">Changing a slot’s time does not move existing bookings. Slots that are not back to back (like a lunch break) cannot be joined into one longer booking.</p>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {(q.data ?? []).map((s) => <SlotRow key={s.id + s.updated_at} s={s} lab={lab} onDone={done} onFail={fail} />)}
        <div className={box + " bg-[#f7f9f8]"}>
          <div><div className={lbl}>New slot start</div><Input type="time" value={n.s} onChange={(e) => setN({ ...n, s: e.target.value })} /></div>
          <div><div className={lbl}>End</div><Input type="time" value={n.e} onChange={(e) => setN({ ...n, e: e.target.value })} /></div>
          <Button className="self-end" disabled={!n.s || !n.e || n.e <= n.s} onClick={async () => {
            const { error } = await supabase.from("slots").insert({ label: lab(n.s, n.e), start_time: n.s, end_time: n.e, sort_order: next });
            if (error) { fail(error); return; }
            setN({ s: "", e: "" }); done();
          }}>Add slot</Button>
        </div>
      </div>
    </div>
  );
}

function SlotRow({ s, lab, onDone, onFail }: { s: { id: string; start_time: string; end_time: string; active: boolean }; lab: (a: string, b: string) => string; onDone: () => void; onFail: (e: { message: string }) => void }) {
  const [v, setV] = useState({ s: s.start_time.slice(0, 5), e: s.end_time.slice(0, 5), a: s.active });
  return (
    <div className={box}>
      <div><div className={lbl}>Start</div><Input type="time" value={v.s} onChange={(e) => setV({ ...v, s: e.target.value })} /></div>
      <div><div className={lbl}>End</div><Input type="time" value={v.e} onChange={(e) => setV({ ...v, e: e.target.value })} /></div>
      <div className="flex items-center gap-2 self-end pb-2 text-sm"><Switch checked={v.a} onCheckedChange={(a) => setV({ ...v, a })} />Active</div>
      <Button className="self-end" variant="outline" disabled={!v.s || !v.e || v.e <= v.s} onClick={async () => {
        const { error } = await supabase.from("slots").update({ label: lab(v.s, v.e), start_time: v.s, end_time: v.e, active: v.a }).eq("id", s.id);
        error ? onFail(error) : onDone();
      }}>Save</Button>
    </div>
  );
}

function Users() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [p, r] = await Promise.all([supabase.from("profiles").select("id,full_name,is_active").order("full_name"), supabase.from("user_roles").select("user_id,role")]);
      return (p.data ?? []).map((u) => ({ ...u, role: r.data?.some((x) => x.user_id === u.id && x.role === "owner") ? "owner" : "manager" }));
    },
  });
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const add = useMutation({
    mutationFn: () => createManager({ data: { fullName: f.name, email: f.email, password: f.password } }),
    onSuccess: () => { toast.success("Manager added"); setF({ name: "", email: "", password: "" }); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => setUserActive({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
      {(q.data ?? []).map((u) => (
        <div key={u.id} className={box}>
          <div className="min-w-0 flex-1"><div className="font-semibold">{u.full_name}</div><div className="text-xs capitalize text-muted-foreground">{u.role}</div></div>
          {u.role !== "owner" && <div className="flex items-center gap-2 text-sm"><Switch checked={u.is_active} onCheckedChange={(a) => toggle.mutate({ userId: u.id, active: a })} />{u.is_active ? "Active" : "Inactive"}</div>}
        </div>
      ))}
      <div className={box + " bg-[#f7f9f8]"}>
        <div className="min-w-[150px] flex-1"><div className={lbl}>New manager name</div><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="min-w-[180px] flex-1"><div className={lbl}>Email</div><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="min-w-[150px] flex-1"><div className={lbl}>Password (8+)</div><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <Button className="self-end" disabled={!f.name.trim() || !f.email.includes("@") || f.password.length < 8 || add.isPending} onClick={() => add.mutate()}>Add manager</Button>
      </div>
    </div>
  );
}

function InvoiceSettings() {
  const cfg = useAppSettings().data ?? DEFAULTS;
  const save = useSaveSettings();
  const [f, setF] = useState<Record<string, string> | null>(null);
  const v = f ?? { clinic_name: cfg.clinic_name, clinic_address: cfg.clinic_address, clinic_phone: cfg.clinic_phone, invoice_footer: cfg.invoice_footer };
  const field = (k: string, label: string) => (
    <div className="mb-3"><div className={lbl}>{label}</div><Input value={v[k]} onChange={(e) => setF({ ...v, [k]: e.target.value })} /></div>
  );
  return (
    <div className="mt-4 max-w-xl rounded-2xl border bg-card p-4">
      {field("clinic_name", "Clinic name")}{field("clinic_address", "Address")}{field("clinic_phone", "Phone (leave empty to hide)")}{field("invoice_footer", "Footer message")}
      <div className="mb-4 flex items-center justify-between"><span className="text-sm">Hide discount on invoice by default</span>
        <Switch checked={cfg.invoice_hide_discount} onCheckedChange={(c) => save({ invoice_hide_discount: c }).then(() => toast.success("Saved"), (e: Error) => toast.error(e.message))} /></div>
      <Button disabled={!f} onClick={() => save(v).then(() => { setF(null); toast.success("Saved"); }, (e: Error) => toast.error(e.message))}>Save</Button>
    </div>
  );
}

const MENU = [["/dashboard", "Dashboard"], ["/patients", "Patients"], ["/expenses", "Expenses"], ["/staff", "Staff"]] as const;
function DisplaySettings() {
  const cfg = useAppSettings().data ?? DEFAULTS;
  const save = useSaveSettings();
  const done = (p: Promise<void>) => p.then(() => toast.success("Saved"), (e: Error) => toast.error(e.message));
  return (
    <div className="mt-4 max-w-xl overflow-hidden rounded-2xl border bg-card">
      <div className={box}><span className="flex-1 text-sm">Show patient names on Pending</span>
        <Switch checked={cfg.pending_show_names} onCheckedChange={(c) => done(save({ pending_show_names: c }))} /></div>
      {MENU.map(([to, name]) => (
        <div key={to} className={box}><span className="flex-1 text-sm">Show {name} in menu</span>
          <Switch checked={!cfg.hidden_nav.includes(to)} onCheckedChange={(c) => done(save({ hidden_nav: c ? cfg.hidden_nav.filter((x) => x !== to) : [...cfg.hidden_nav, to] }))} /></div>
      ))}
    </div>
  );
}
