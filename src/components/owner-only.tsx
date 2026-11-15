import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useMe } from "@/lib/auth";

export function OwnerOnly({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const nav = useNavigate();
  const blocked = !!me && me.role !== "owner";
  useEffect(() => {
    if (blocked) nav({ to: "/appointments" });
  }, [blocked, nav]);
  return me && !blocked ? <>{children}</> : null;
}
