"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type Phase = "idle" | "uploading" | "starting" | "processing" | "done" | "error";
type SentinelStatus = "idle" | "scoring" | "done" | "error";

interface ResultData {
  originalUrl: string;
  processedUrl: string;
}

export default function ToolClient() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [sentinelStatus, setSentinelStatus] = useState<SentinelStatus>("idle");
  const [sentinelScore, setSentinelScore] = useState<number | null>(null);
  const [sentinelVerdict, setSentinelVerdict] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentinelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (sentinelTimerRef.current) clearTimeout(sentinelTimerRef.current);
    };
  }, []);

  const startSentinelPolling = useCallback((evalId: string) => {
    let attempts = 0;
    const maxAttempts = 16; // 25s + 16×15s ≈ 4.5 min max

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/sentinel/${evalId}`);
        if (!res.ok) throw new Error("Poll failed");
        const data = await res.json();

        if (data.status !== "running") {
          if (data.status === "completed") {
            const rate = data.weighted_pass_rate ?? data.score ?? 0;
            setSentinelScore(Math.round(rate * 100));
            setSentinelVerdict(data.verdict ?? null);
            setSentinelStatus("done");
          } else {
            setSentinelStatus("error");
          }
          return;
        }

        if (attempts < maxAttempts) {
          sentinelTimerRef.current = setTimeout(poll, 15_000);
        } else {
          setSentinelStatus("error");
        }
      } catch {
        setSentinelStatus("error");
      }
    };

    sentinelTimerRef.current = setTimeout(poll, 25_000);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (JPG, PNG, WEBP).");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File must be under 10 MB.");
        return;
      }

      setError(null);
      setResult(null);
      setSentinelStatus("idle");
      setSentinelScore(null);
      setSentinelVerdict(null);
      if (sentinelTimerRef.current) clearTimeout(sentinelTimerRef.current);

      const localPreview = URL.createObjectURL(file);
      setPhase("uploading");

      try {
        // 1. Upload to Vercel Blob
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const msg = await uploadRes.text();
          throw new Error(`Upload failed: ${msg}`);
        }
        const { url: blobUrl } = await uploadRes.json();

        // 2. Start Runflow background removal job
        setPhase("starting");
        const processRes = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: blobUrl }),
        });
        if (!processRes.ok) throw new Error("Failed to start processing");
        const { runId } = await processRes.json();

        // 3. Poll Runflow until done
        setPhase("processing");
        let processedUrl: string | null = null;
        let attempts = 0;
        const maxAttempts = 40; // 40 × 3s = 2 minutes max

        while (!processedUrl && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 3_000));
          attempts++;

          const pollRes = await fetch(`/api/runs/${runId}`);
          if (!pollRes.ok) throw new Error("Failed to check run status");
          const runData = await pollRes.json();

          if (runData.status_code === "succeeded") {
            // Try common output shapes
            processedUrl =
              runData.output?.image_urls?.[0] ??
              runData.output?.outputs?.[0]?.url ??
              (Array.isArray(runData.output) ? runData.output[0] : null);
            if (!processedUrl) throw new Error("No output URL in response");
          } else if (runData.status_code === "failed" || runData.status_code === "cancelled") {
            throw new Error(runData.failure_message ?? "Processing failed");
          }
        }

        if (!processedUrl) throw new Error("Processing timed out. Please try again.");

        setResult({ originalUrl: localPreview, processedUrl });
        setPhase("done");

        // 4. Submit to Sentinel (non-blocking)
        setSentinelStatus("scoring");
        try {
          const sentinelRes = await fetch("/api/sentinel/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: processedUrl, originalUrl: blobUrl }),
          });
          if (!sentinelRes.ok) throw new Error("Sentinel submit failed");
          const sentinelData = await sentinelRes.json();
          const evalId: string | undefined = sentinelData.evalId;
          if (!evalId) throw new Error("No eval ID from Sentinel");
          startSentinelPolling(evalId);
        } catch {
          setSentinelStatus("error");
        }
      } catch (err) {
        URL.revokeObjectURL(localPreview);
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        setPhase("error");
      }
    },
    [startSentinelPolling]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleReset = useCallback(() => {
    if (sentinelTimerRef.current) clearTimeout(sentinelTimerRef.current);
    if (result?.originalUrl) URL.revokeObjectURL(result.originalUrl);
    setPhase("idle");
    setResult(null);
    setSentinelStatus("idle");
    setSentinelScore(null);
    setSentinelVerdict(null);
    setError(null);
  }, [result]);

  if (phase === "done" && result) {
    return (
      <ResultView
        result={result}
        sentinelStatus={sentinelStatus}
        sentinelScore={sentinelScore}
        sentinelVerdict={sentinelVerdict}
        onReset={handleReset}
      />
    );
  }

  if (phase !== "idle" && phase !== "error") {
    return <ProcessingView phase={phase} />;
  }

  return (
    <div>
      {error && (
        <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={[
          "border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center gap-5 cursor-pointer transition-colors",
          isDragging
            ? "border-rose-500 bg-rose-50"
            : "border-gray-200 hover:border-rose-400 hover:bg-rose-50/50",
        ].join(" ")}
      >
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-gray-900">Drop your Depop photo here</p>
          <p className="text-sm text-gray-400 mt-1">
            or click to choose · JPG, PNG, WEBP up to 10 MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        Background removed · Cropped to 1:1 · Ready for Depop listing
      </p>
    </div>
  );
}

function ProcessingView({ phase }: { phase: Phase }) {
  const labels: Record<string, string> = {
    uploading: "Uploading your photo…",
    starting: "Starting AI…",
    processing: "Removing background…",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24">
      <div className="w-14 h-14 rounded-full border-4 border-gray-100 border-t-rose-500 animate-spin" />
      <div className="text-center">
        <p className="text-base font-medium text-gray-900">
          {labels[phase] ?? "Processing…"}
        </p>
        <p className="text-sm text-gray-400 mt-1">Usually takes 10–20 seconds</p>
      </div>
    </div>
  );
}

function ResultView({
  result,
  sentinelStatus,
  sentinelScore,
  sentinelVerdict,
  onReset,
}: {
  result: ResultData;
  sentinelStatus: SentinelStatus;
  sentinelScore: number | null;
  sentinelVerdict: string | null;
  onReset: () => void;
}) {
  const verdictStyle =
    sentinelVerdict === "pass"
      ? "bg-green-100 text-green-700"
      : sentinelVerdict === "soft_fail"
      ? "bg-yellow-100 text-yellow-700"
      : sentinelVerdict === "hard_fail"
      ? "bg-red-100 text-red-700"
      : "bg-gray-100 text-gray-500";

  const verdictLabel =
    sentinelVerdict === "pass"
      ? "✓ Pass"
      : sentinelVerdict === "soft_fail"
      ? "Soft fail"
      : sentinelVerdict === "hard_fail"
      ? "Hard fail"
      : sentinelVerdict ?? "Unknown";

  return (
    <div className="space-y-6">
      {/* Before / After */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Original</p>
          <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.originalUrl}
              alt="Original photo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Clean (1:1)</p>
          <div
            className="aspect-square rounded-xl overflow-hidden"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='8' height='8' fill='%23e5e7eb'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23e5e7eb'/%3E%3Crect x='8' width='8' height='8' fill='%23f9fafb'/%3E%3Crect y='8' width='8' height='8' fill='%23f9fafb'/%3E%3C/svg%3E\")",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.processedUrl}
              alt="Cleaned photo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <a
          href={result.processedUrl}
          download="depop-photo.png"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-full transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download photo
        </a>

        {/* Quality score */}
        <div className="text-right">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">AI Quality Score</p>
          {sentinelStatus === "scoring" && (
            <div className="flex items-center justify-end gap-2 text-sm text-gray-500">
              <div className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-rose-500 animate-spin" />
              Scoring… (takes ~2 min)
            </div>
          )}
          {sentinelStatus === "done" && sentinelScore !== null && (
            <div className="flex items-center justify-end gap-2">
              <span className="text-2xl font-bold text-gray-900">{sentinelScore}</span>
              <span className="text-sm text-gray-400">/100</span>
              {sentinelVerdict && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${verdictStyle}`}>
                  {verdictLabel}
                </span>
              )}
            </div>
          )}
          {sentinelStatus === "error" && (
            <span className="text-sm text-gray-400">Score unavailable</span>
          )}
          {sentinelStatus === "idle" && (
            <span className="text-sm text-gray-400">—</span>
          )}
        </div>
      </div>

      {sentinelStatus === "scoring" && (
        <p className="text-xs text-gray-400">
          Quality score is processing in the background. This page will update automatically.
        </p>
      )}

      <button
        onClick={onReset}
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        ← Clean another photo
      </button>
    </div>
  );
}
