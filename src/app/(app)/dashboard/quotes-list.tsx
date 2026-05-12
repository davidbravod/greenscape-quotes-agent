"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Quote = {
  id: string;
  client_name: string | null;
  status: string;
  total: number | null;
  created_at: string;
};

export default function QuotesList({
  initial,
  userId,
  isAdmin,
}: {
  initial: Quote[];
  userId: string;
  isAdmin: boolean;
}) {
  const [quotes, setQuotes] = useState<Quote[]>(initial);

  useEffect(() => {
    const supabase = createClient();

    async function refresh() {
      let query = supabase
        .from("quotes")
        .select("id, client_name, status, total, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!isAdmin) {
        query = query.eq("created_by", userId);
      }
      const { data } = await query;
      if (data) setQuotes(data);
    }

    const channel = supabase
      .channel("quotes-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, refresh)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (quotes.length === 0) {
    return (
      <p className="text-sm text-black/60">
        No quotes yet. Record a site walk to generate one.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-left border-b border-black/10">
        <tr>
          <th className="py-2">Client</th>
          <th>Status</th>
          <th>Total</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {quotes.map((q) => (
          <tr key={q.id} className="border-b border-black/5">
            <td className="py-2">
              <Link href={`/quotes/${q.id}`} className="hover:underline">
                {q.client_name ?? "Untitled"}
              </Link>
            </td>
            <td>{q.status}</td>
            <td>{q.total ? `$${Number(q.total).toFixed(2)}` : "—"}</td>
            <td>{new Date(q.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
