import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import QuotesList from "./quotes-list";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, client_name, status, total, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quotes</h1>
        <Link
          href="/record"
          className="border border-black px-3 py-1.5 text-sm hover:bg-black hover:text-white"
        >
          New from audio
        </Link>
      </div>
      <QuotesList initial={quotes ?? []} />
    </div>
  );
}
