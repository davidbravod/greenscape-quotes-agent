import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

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
      {!quotes || quotes.length === 0 ? (
        <p className="text-sm text-black/60">
          No quotes yet. Record a site walk to generate one.
        </p>
      ) : (
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
      )}
    </div>
  );
}
