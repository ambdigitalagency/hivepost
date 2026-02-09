"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./AppHeader";

export function DashboardHeader() {
  const pathname = usePathname();
  const match = pathname?.match(/\/dashboard\/business\/([^/]+)/);
  const segment = match?.[1];
  const businessId = segment && segment !== "new" ? segment : undefined;

  return <AppHeader dashboardNav businessId={businessId} />;
}
