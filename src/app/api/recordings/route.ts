import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runRecordingPipeline } from "@/lib/pipeline";

// POST /api/recordings
// Body: { storage_path: string; duration_s?: number }
// Creates the DB row then kicks off the pipeline via after()
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { storage_path: string; duration_s?: number };
  if (!body.storage_path) {
    return NextResponse.json({ error: "storage_path required" }, { status: 400 });
  }

  const { data: recording, error } = await supabase
    .from("recordings")
    .insert({
      user_id: user.id,
      storage_path: body.storage_path,
      duration_s: body.duration_s ?? null,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error || !recording) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }

  after(async () => {
    await runRecordingPipeline(recording.id);
  });

  return NextResponse.json({ id: recording.id }, { status: 202 });
}
