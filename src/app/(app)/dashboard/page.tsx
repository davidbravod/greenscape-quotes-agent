import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import QuotesList from "./quotes-list";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user!.id)
    .single();
  const isAdmin = profile?.role === "admin";

  let query = supabase
    .from("quotes")
    .select("id, client_name, status, total, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!isAdmin) {
    query = query.eq("created_by", user!.id);
  }

  const { data: quotes } = await query;

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
      <QuotesList initial={quotes ?? []} userId={user!.id} isAdmin={isAdmin} />
    </div>
  );
}
