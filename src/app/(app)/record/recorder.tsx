"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Phase =
  | "idle"
  | "recording"
  | "recorded"
  | "uploading"
  | "transcribing"
  | "drafting"
  | "done"
  | "error";

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Queued…",
  transcribing: "Transcribing audio…",
  transcribed: "Transcript ready. Drafting quote…",
  drafting: "Drafting quote…",
  drafted: "Done",
  failed: "Processing failed",
};

export default function Recorder({ userId }: { userId: string }) {
  const router = useRouter();
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [statusText, setStatusText] = useState("");
  const [recordingId, setRecordingId] = useState<string | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [previewUrl]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const recorded = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const url = URL.createObjectURL(recorded);
        setBlob(recorded);
        setPreviewUrl(url);
        setPhase("recorded");
        if (timerRef.current) clearInterval(timerRef.current);
      };
      mr.start(1000);
      mediaRef.current = mr;
      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setElapsed(0);
    setPhase("idle");
    setStatusText("");
    setRecordingId(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBlob(file);
    setPreviewUrl(url);
    setPhase("recorded");
  }

  async function upload() {
    if (!blob) return;
    setPhase("uploading");

    const supabase = createClient();
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("recordings")
      .upload(path, blob, { contentType: blob.type, upsert: false });

    if (uploadErr) {
      toast.error(`Upload failed: ${uploadErr.message}`);
      setPhase("recorded");
      return;
    }

    // Create DB row + kick off pipeline
    const res = await fetch("/api/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storage_path: path,
        duration_s: Math.round(elapsed) || null,
      }),
    });

    if (!res.ok) {
      toast.error("Failed to start processing");
      setPhase("recorded");
      return;
    }

    const { id } = (await res.json()) as { id: string };
    setRecordingId(id);
    setPhase("transcribing");
    setStatusText("Transcribing audio…");
    startPolling(id);
  }

  function startPolling(id: string) {
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/recordings/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        status: string;
        error?: string;
        quote_id?: string;
      };

      setStatusText(STATUS_LABELS[data.status] ?? data.status);

      if (data.status === "drafted" && data.quote_id) {
        clearInterval(pollRef.current!);
        setPhase("done");
        router.push(`/quotes/${data.quote_id}`);
      } else if (data.status === "failed") {
        clearInterval(pollRef.current!);
        setPhase("error");
        toast.error(data.error ?? "Processing failed");
      } else if (data.status === "drafting") {
        setPhase("drafting");
      }
    }, 3000);
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-8 max-w-lg">
      {/* ── Idle / recording / recorded ── */}
      {(phase === "idle" || phase === "recording" || phase === "recorded") && (
        <div className="space-y-6">
          {phase === "idle" && (
            <div className="space-y-4">
              <Button onClick={startRecording} className="w-full">
                Start recording
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-black/10" />
                </div>
                <div className="relative flex justify-center text-xs text-black/40">
                  <span className="bg-white px-2">or upload a file</span>
                </div>
              </div>
              <label className="block border border-dashed border-black/20 p-6 text-center text-sm text-black/50 cursor-pointer hover:border-black/40">
                <input
                  type="file"
                  accept="audio/*"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                Click to pick an audio file (.m4a, .mp3, .webm, .ogg)
              </label>
            </div>
          )}

          {phase === "recording" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-black animate-pulse" />
                <span className="font-mono text-lg">{fmt(elapsed)}</span>
              </div>
              <Button onClick={stopRecording} variant="outline" className="w-full">
                Stop recording
              </Button>
            </div>
          )}

          {phase === "recorded" && previewUrl && (
            <div className="space-y-4">
              <audio src={previewUrl} controls className="w-full" />
              <div className="flex gap-3">
                <Button onClick={upload} className="flex-1">
                  Upload & process
                </Button>
                <Button onClick={reset} variant="outline">
                  Re-record
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Processing states ── */}
      {(phase === "uploading" ||
        phase === "transcribing" ||
        phase === "drafting") && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-black animate-pulse" />
            <span className="text-sm">
              {phase === "uploading" ? "Uploading audio…" : statusText}
            </span>
          </div>
          <p className="text-xs text-black/50">
            This usually takes 1–3 minutes for a 10-minute memo. You can leave
            this page — the quote will appear in your dashboard when ready.
          </p>
          {recordingId && (
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs underline text-black/50"
            >
              Go to dashboard
            </button>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-3">
          <p className="text-sm text-red-600">Processing failed. Check the status in your dashboard.</p>
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
