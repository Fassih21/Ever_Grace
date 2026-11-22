import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CircleDollarSign, LayoutGrid, FileText, LogOut, Receipt, Settings, UserCog, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { DEFAULTS, useAppSettings } from "@/lib/settings";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, owner: true },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/pending", label: "Pending", icon: CircleDollarSign },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/staff", label: "Staff", icon: UserCog },
  { to: "/settings", label: "Settings", icon: Settings, owner: true },
] as const;

function AppLayout() {
  const { data: me, isLoading } = useMe();
  const hidden = (useAppSettings().data ?? DEFAULTS).hidden_nav;
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isLoading && !me) nav({ to: "/login" });
  }, [me, isLoading, nav]);

  if (!me) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  const items = NAV.filter((n) => !("owner" in n && n.owner) || me.role === "owner").filter((n) => !hidden.includes(n.to));
  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#14211f] px-4 py-6 text-[#cfe0dc] md:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <img src="/logo-mark.png" alt="Evergrace" className="size-11 rounded-xl" />
          <div><div className="serif text-xl leading-tight text-white">Evergrace</div><div className="text-xs text-[#7fa39b]">Aesthetics Clinic</div></div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-[#223a36]" activeProps={{ className: "bg-[#223a36] text-white" }}>
              <Icon className="size-[18px]" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-[#2a403c] pt-3 text-xs">
          <div className="text-sm font-semibold text-white">{me.name}</div>
          <div className="capitalize">{me.role}</div>
          <button onClick={signOut} className="mt-2 flex items-center gap-2 text-[#9ebdb5] hover:text-white">
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8 md:pt-7">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t bg-card pb-3 pt-2 md:hidden">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex min-w-[76px] flex-1 flex-col items-center gap-1 text-[11px] font-medium text-muted-foreground" activeProps={{ className: "text-primary" }}>
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
        <button onClick={signOut} className="flex min-w-[76px] flex-1 flex-col items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <LogOut className="size-5" />
          Sign out
        </button>
      </nav>
    </div>
  );
}
