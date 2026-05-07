import { useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { RESERVED_ROUTE_SEGMENTS, setAdminTenantSlug, withUiBase } from "@/lib/paths";

/** Migra URLs antiguas `/:campaignSlug/admin` al panel global `/admin` con tenant preseleccionado. */
export function LegacyAdminTenantRedirect({ campaignSlug }: { campaignSlug: string }) {
  const [, setLocation] = useLocation();

  useLayoutEffect(() => {
    if (campaignSlug && !RESERVED_ROUTE_SEGMENTS.has(campaignSlug)) {
      setAdminTenantSlug(campaignSlug);
    }
    setLocation(withUiBase("/admin"), { replace: true });
  }, [campaignSlug, setLocation]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span>Abriendo administración…</span>
    </div>
  );
}
