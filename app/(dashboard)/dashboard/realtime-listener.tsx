"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface RealtimeListenerProps {
  businessId: string;
}

export function DashboardRealtimeListener({ businessId }: RealtimeListenerProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to calls updates for this business
    const callsChannel = supabase
      .channel(`business-calls-${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaigns",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "callbacks",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    // Fallback polling interval every 20 seconds
    const interval = setInterval(() => {
      router.refresh();
    }, 20000);

    return () => {
      supabase.removeChannel(callsChannel);
      clearInterval(interval);
    };
  }, [businessId, router]);

  return null;
}
