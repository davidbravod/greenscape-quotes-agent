import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Recorder from "./recorder";

export default async function RecordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">New site-walk recording</h1>
        <p className="text-sm text-black/60 mt-1">
          Record or upload your site-walk memo. The agent will draft a quote automatically.
        </p>
      </div>
      <Recorder userId={user.id} />
    </div>
  );
}
