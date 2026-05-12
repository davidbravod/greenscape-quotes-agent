import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("user_id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-black/10">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold tracking-tight">
            GREENSCAPE PRO
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="hover:underline">Quotes</Link>
            <Link href="/record" className="hover:underline">Record</Link>
            {isAdmin && (
              <>
                <Link href="/admin/catalog" className="hover:underline">Catalog</Link>
                <Link href="/admin/agent" className="hover:underline">Agent</Link>
                <Link href="/admin/settings" className="hover:underline">Settings</Link>
                <Link href="/admin/users" className="hover:underline">Users</Link>
              </>
            )}
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
