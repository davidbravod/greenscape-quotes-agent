"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ResyncButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleResync() {
    setLoading(true);
    try {
      const res = await fetch("/api/sync-catalog", {
        method: "POST",
        headers: { "x-sync-secret": "" }, // secret checked server-side via cookie auth for admin
      });
      const json = (await res.json()) as {
        rows_upserted?: number;
        rows_deactivated?: number;
        error?: string;
      };
      if (!res.ok || json.error) {
        toast.error(json.error ?? "Sync failed");
      } else {
        toast.success(
          `Synced ${json.rows_upserted} items, deactivated ${json.rows_deactivated}`,
        );
        router.refresh();
      }
    } catch {
      toast.error("Network error — sync did not complete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleResync} disabled={loading}>
      {loading ? "Syncing…" : "Resync now"}
    </Button>
  );
}
