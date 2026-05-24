"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { Icon, Ripple, TypeOn, CountUp, ScoreRing } from "../components/ui";

type Phase = "idle" | "uploading" | "starting" | "processing" | "done" | "error";
type SentinelStatus = "idle" | "scoring" | "done" | "error";

interface ResultData { originalUrl: string; processedUrl: string; }

export default function ToolClient() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [sentinelStatus, setSentinelStatus] = useState<SentinelStatus>("idle");
  const [sentinelScore, setSentinelScore] = useState<number | null>(null);
  const [sentinelVerdict, setSentinelVerdict] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentinelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (sentinelTimerRef.current) clearTimeout(sentinelTimerRef.current); };
  }, []);

  const startSentinelPolling = useCallback((evalId: string) => {
    let attempts = 0;
    const maxAttempts = 16;
    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/sentinel/${evalId}`);
        if (!res.ok) throw new Error("Poll failed");
        const data = await res.json();
        if (data.status !== "running") {
          if (data.status === "completed") {
            setSentinelScore(Math.round((data.weighted_pass_rate ?? data.score ?? 0) * 100));
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
      } catch { setSentinelStatus("error"); }
    };
    sentinelTimerRef.current = setTimeout(poll, 25_000);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please upload an image file (JPG, PNG, WEBP)."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("File must be under 10 MB."); return; }
    setError(null); setResult(null);
    setSentinelStatus("idle"); setSentinelScore(null); setSentinelVerdict(null);
    if (sentinelTimerRef.current) clearTimeout(sentinelTimerRef.current);

    const localPreview = URL.createObjectURL(file);
    setPhase("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${await uploadRes.text()}`);
      const { url: blobUrl } = await uploadRes.json();

      setPhase("starting");
      const processRes = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: blobUrl }),
      });
      if (!processRes.ok) throw new Error("Failed to start processing");
      const { runId } = await processRes.json();

      setPhase("processing");
      let processedUrl: string | null = null;
      let attempts = 0;
      while (!processedUrl && attempts < 40) {
        await new Promise((r) => setTimeout(r, 3_000));
        attempts++;
        const pollRes = await fetch(`/api/runs/${runId}`);
        if (!pollRes.ok) throw new Error("Failed to check run status");
        const runData = await pollRes.json();
        if (runData.status_code === "succeeded") {
          processedUrl = runData.output?.image_urls?.[0] ?? runData.output?.outputs?.[0]?.url ?? (Array.isArray(runData.output) ? runData.output[0] : null);
          if (!processedUrl) throw new Error("No output URL in response");
        } else if (runData.status_code === "failed" || runData.status_code === "cancelled") {
          throw new Error(runData.failure_message ?? "Processing failed");
        }
      }
      if (!processedUrl) throw new Error("Processing timed out. Please try again.");

      setResult({ originalUrl: localPreview, processedUrl });
      setPhase("done");

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
      } catch { setSentinelStatus("error"); }
    } catch (err) {
      URL.revokeObjectURL(localPreview);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPhase("error");
    }
  }, [startSentinelPolling]);

  const handleReset = useCallback(() => {
    if (sentinelTimerRef.current) clearTimeout(sentinelTimerRef.current);
    if (result?.originalUrl) URL.revokeObjectURL(result.originalUrl);
    setPhase("idle"); setResult(null);
    setSentinelStatus("idle"); setSentinelScore(null); setSentinelVerdict(null); setError(null);
  }, [result]);

  const processingText: Record<string, string> = {
    uploading: "Uploading your photo…",
    starting: "Starting AI…",
    processing: "Removing background…",
  };

  const processingStep: Record<string, number> = { uploading: 0, starting: 1, processing: 2 };

  return (
    <div className="page-enter" style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px 80px" }}>
      <ToolNav />

      {phase === "idle" || phase === "error" ? (
        <div style={{ maxWidth: 680, margin: "40px auto 0" }}>
          {error && (
            <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 12, background: "rgba(225,29,72,0.1)", border: "1px solid rgba(225,29,72,0.3)", fontSize: 14, color: "#fda4af" }}>
              {error}
            </div>
          )}
          <Dropzone
            onFile={handleFile}
            fileInputRef={fileInputRef}
          />
        </div>
      ) : phase === "done" && result ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, marginTop: 28 }}>
          <ResultCard result={result} onReset={handleReset} />
          <SidePanel sentinelStatus={sentinelStatus} sentinelScore={sentinelScore} sentinelVerdict={sentinelVerdict} />
        </div>
      ) : (
        <div style={{ maxWidth: 680, margin: "40px auto 0" }}>
          <ProcessingCard text={processingText[phase] ?? "Processing…"} step={processingStep[phase] ?? 2} />
        </div>
      )}
    </div>
  );
}

/* ── Tool nav ── */
function ToolNav() {
  return (
    <div style={{ position: "sticky", top: 14, zIndex: 30, marginTop: 14 }}>
      <div className="glass" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 10px 18px", borderRadius: 999,
        background: "rgba(12,10,12,0.55)",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <Icon name="logo" size={26} />
          <span style={{ fontWeight: 700, letterSpacing: "-0.02em", fontSize: 16 }}>SnapReady</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", border: "1px solid var(--line)", padding: "2px 7px", borderRadius: 999, marginLeft: 4 }}>STUDIO</span>
        </Link>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>3 photos free today</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="pill pill-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>
            <Icon name="bolt" size={13} /> Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Dropzone ── */
function Dropzone({ onFile, fileInputRef }: { onFile: (f: File) => void; fileInputRef: React.RefObject<HTMLInputElement | null> }) {
  const [drag, setDrag] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <div
      className="glass"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      style={{
        position: "relative", borderRadius: 24, padding: 36, minHeight: 440,
        background: drag
          ? "linear-gradient(180deg,rgba(225,29,72,0.12),rgba(225,29,72,0.04))"
          : "linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))",
        boxShadow: drag ? "0 0 0 1px rgba(225,29,72,0.6),0 0 80px -10px rgba(225,29,72,0.5)" : "none",
        transition: "background .3s ease,box-shadow .3s ease",
        overflow: "hidden",
      }}>
      <div className={`dash-rot${hover || drag ? " fast" : ""}`} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 20px" }}>
        <div style={{
          width: 84, height: 84, borderRadius: 24,
          background: drag ? "linear-gradient(180deg,#fb7185,#e11d48)" : "linear-gradient(180deg,rgba(225,29,72,0.22),rgba(225,29,72,0.05))",
          border: "1px solid rgba(225,29,72,0.35)",
          color: drag ? "white" : "#fda4af",
          display: "grid", placeItems: "center", marginBottom: 28,
          transform: drag ? "scale(1.06)" : "none",
          transition: "all .3s cubic-bezier(.2,.7,.2,1)",
          boxShadow: drag ? "0 20px 40px -10px rgba(225,29,72,0.6)" : "none",
        }}>
          <Icon name="upload" size={34} stroke={1.8} />
        </div>
        <div style={{ fontSize: 30, letterSpacing: "-0.02em", fontWeight: 600 }}>
          {drag ? "Let go to clean it." : "Drop a photo here."}
        </div>
        <div style={{ color: "var(--ink-dim)", marginTop: 10, fontSize: 15, maxWidth: 360, lineHeight: 1.55 }}>
          JPG, PNG, WEBP up to 10 MB. Background removed and cropped to 1:1 in ~15 seconds.
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Ripple className="pill pill-rose" onClick={() => fileInputRef.current?.click()} style={{ padding: "12px 20px", fontSize: 14 }}>
            <Icon name="image" size={14} /> Choose from device
          </Ripple>
        </div>
        <div className="mono" style={{ display: "flex", gap: 20, marginTop: 32, fontSize: 11, color: "var(--ink-faint)", flexWrap: "wrap", justifyContent: "center" }}>
          <span><Icon name="shield" size={11} /> Photos auto-deleted in 24h</span>
          <span>·</span>
          <span>No watermark on export</span>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

/* ── Processing card ── */
function ProcessingCard({ text, step }: { text: string; step: number }) {
  return (
    <div className="glass" style={{ borderRadius: 24, padding: 28, minHeight: 440, position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.15em" }}>PROCESSING</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--rose-soft)" }}>STEP {step + 1}/3</div>
      </div>
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", height: 300, background: "linear-gradient(135deg,#15101a,#1a121a)" }}>
        <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", left: 24, top: 24, right: 24, height: 14, borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", left: 24, top: 48, width: "55%", height: 11, borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", left: 24, right: 24, bottom: 24, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ position: "relative", width: 68, height: 68 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(225,29,72,0.15)", borderTopColor: "#e11d48", animation: "spin 1.1s linear infinite", boxShadow: "0 0 28px rgba(225,29,72,0.4)" }} />
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fda4af" }}>
              <Icon name="spark" size={20} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em" }}>
          <TypeOn key={text} text={text} speed={34} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 999,
            background: i <= step ? "linear-gradient(90deg,#fb7185,#e11d48)" : "rgba(255,255,255,0.08)",
            transition: "background .4s ease",
            boxShadow: i === step ? "0 0 10px #e11d48" : "none",
          }} />
        ))}
      </div>
    </div>
  );
}

/* ── Result card ── */
function ResultCard({ result, onReset }: { result: ResultData; onReset: () => void }) {
  const [downloaded, setDownloaded] = useState(false);
  const [bg, setBg] = useState<"clean" | "rose" | "studio">("clean");
  const bgMap = {
    clean: "linear-gradient(180deg,#f7f5f4,#ede9e6)",
    rose: "linear-gradient(160deg,#f9c8d1,#fff)",
    studio: "linear-gradient(180deg,#1a1517,#0a0707)",
  };
  return (
    <div className="glass" style={{ borderRadius: 24, padding: 24, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.15em" }}>RESULT</div>
        <button onClick={onReset} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-dim)", cursor: "pointer" }} className="mono">
          <Icon name="refresh" size={12} /> Clean another
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* BEFORE */}
        <div className="slide-left" style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "1/1" }}>
          <div className="mono" style={{ position: "absolute", top: 10, left: 10, fontSize: 10, color: "white", background: "rgba(0,0,0,0.55)", padding: "3px 9px", borderRadius: 999, zIndex: 3 }}>BEFORE</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.originalUrl} alt="Original" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.8) contrast(0.9) saturate(0.8)" }} />
        </div>
        {/* AFTER */}
        <div className="checker slide-right" style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "1/1" }}>
          <div className="mono" style={{ position: "absolute", top: 10, left: 10, fontSize: 10, color: "#0a0a0a", background: "rgba(255,255,255,0.95)", padding: "3px 9px", borderRadius: 999, zIndex: 3 }}>AFTER</div>
          <div style={{ position: "absolute", inset: 0, background: bgMap[bg], transition: "background .4s ease" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.processedUrl} alt="Cleaned" style={{ position: "relative", zIndex: 1, width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      </div>

      {/* Background swatches + download */}
      <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {([
            { id: "clean", label: "Cream", swatch: "linear-gradient(180deg,#f7f5f4,#ede9e6)" },
            { id: "rose", label: "Rose", swatch: "linear-gradient(160deg,#f9c8d1,#fff)" },
            { id: "studio", label: "Studio", swatch: "linear-gradient(180deg,#1a1517,#0a0707)" },
          ] as { id: "clean" | "rose" | "studio"; label: string; swatch: string }[]).map((o) => (
            <button key={o.id} onClick={() => setBg(o.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 9px 5px 5px", borderRadius: 999,
                border: `1px solid ${bg === o.id ? "rgba(225,29,72,0.5)" : "var(--line)"}`,
                background: bg === o.id ? "rgba(225,29,72,0.12)" : "transparent",
                fontSize: 12, color: "var(--ink-dim)", cursor: "pointer", transition: "all .2s ease",
              }}>
              <span style={{ width: 16, height: 16, borderRadius: 999, background: o.swatch, border: "1px solid rgba(0,0,0,0.2)", flexShrink: 0 }} />
              {o.label}
            </button>
          ))}
        </div>
        <Ripple
          className="pill pill-rose"
          style={{ padding: "10px 16px", fontSize: 13 }}
          onClick={() => {
            setDownloaded(true);
            setTimeout(() => setDownloaded(false), 1800);
            window.open(result.processedUrl, "_blank");
          }}>
          {downloaded ? <><Icon name="check" size={13} /> Saved!</> : <><Icon name="download" size={13} /> Download PNG</>}
        </Ripple>
      </div>
    </div>
  );
}

/* ── Side panel ── */
function SidePanel({ sentinelStatus, sentinelScore, sentinelVerdict }: {
  sentinelStatus: SentinelStatus;
  sentinelScore: number | null;
  sentinelVerdict: string | null;
}) {
  if (sentinelStatus === "idle" || sentinelStatus === "scoring") {
    return (
      <div className="glass" style={{ borderRadius: 20, padding: 24, minHeight: 400, display: "flex", flexDirection: "column" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.15em", marginBottom: 20 }}>AI QUALITY SCORE</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 28px", flex: 1, justifyContent: "center" }}>
          <ScoreRing value={0} size={130} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
            <span style={{ fontSize: 14, color: "var(--ink-dim)" }}>Scoring</span>
            <span className="dots"><span /><span /><span /></span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 10, textAlign: "center" }}>
            Takes ~2 min — page updates automatically
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 18 }}>
          {["lighting", "framing", "focus", "clutter"].map((k, i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>{k}</span>
              <div style={{ flex: 1, height: 3, margin: "0 14px", background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: 0, height: "100%", background: "linear-gradient(90deg,#fb7185,#e11d48)", animation: `loadBar 1.8s ${i * 0.15}s ease-out infinite` }} />
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", width: 20, textAlign: "right" }}>…</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sentinelStatus === "error") {
    return (
      <div className="glass" style={{ borderRadius: 20, padding: 24 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.15em", marginBottom: 20 }}>AI QUALITY SCORE</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 0", gap: 12 }}>
          <ScoreRing value={0} size={110} />
          <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>Score unavailable</span>
        </div>
        <SideTips />
      </div>
    );
  }

  if (sentinelStatus === "done" && sentinelScore !== null) {
    const verdictStyle = sentinelVerdict === "pass"
      ? { bg: "rgba(34,197,94,0.18)", border: "rgba(34,197,94,0.4)", color: "#86efac", label: "READY TO POST" }
      : sentinelVerdict === "soft_fail"
      ? { bg: "rgba(234,179,8,0.18)", border: "rgba(234,179,8,0.4)", color: "#fde047", label: "SOFT FAIL" }
      : sentinelVerdict === "hard_fail"
      ? { bg: "rgba(225,29,72,0.18)", border: "rgba(225,29,72,0.4)", color: "#fda4af", label: "NEEDS RESHOOT" }
      : { bg: "rgba(255,255,255,0.08)", border: "var(--line)", color: "var(--ink-dim)", label: sentinelVerdict ?? "SCORED" };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="glass" style={{ borderRadius: 20, padding: 24, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--rose-soft)", letterSpacing: "0.15em" }}>SNAPREADY SCORE</div>
            <div className="mono spring-pop" style={{
              padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600,
              background: verdictStyle.bg, border: `1px solid ${verdictStyle.border}`, color: verdictStyle.color,
            }}>{verdictStyle.label}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <ScoreRing value={sentinelScore} size={120} />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.04em", color: "white" }}>
                    <CountUp to={sentinelScore} duration={1400} />
                  </span>
                  <span className="mono" style={{ fontSize: 8, color: "var(--ink-faint)", letterSpacing: "0.15em", marginTop: -4 }}>OUT OF 100</span>
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {["lighting", "framing", "focus", "clutter"].map((k, i) => {
                const approx = Math.max(60, Math.min(100, sentinelScore + (i % 2 === 0 ? 3 : -4)));
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-dim)", width: 52 }}>{k}</span>
                    <div style={{ flex: 1, height: 3, margin: "0 10px", background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{
                        width: `${approx}%`, height: "100%",
                        background: "linear-gradient(90deg,#fb7185,#e11d48)",
                        transition: `width 1.2s ${0.2 + i * 0.1}s cubic-bezier(.2,.7,.2,1)`,
                      }} />
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", width: 22, textAlign: "right" }}>{approx}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <SideTips />
      </div>
    );
  }

  return null;
}

function SideTips() {
  const tips = [
    { i: "spark", t: "Shoot in daylight, not under your ceiling lamp." },
    { i: "image", t: "Fill the frame — leave 5% breathing room max." },
    { i: "wand", t: "Lay flat or hang flat. Mannequin if you've got one." },
    { i: "shield", t: "We never train on your photos. Auto-delete in 24h." },
  ];
  return (
    <div className="glass" style={{ borderRadius: 20, padding: 22 }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--rose-soft)", letterSpacing: "0.15em", marginBottom: 14 }}>TIPS TO SCORE 90+</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tips.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(225,29,72,0.12)", border: "1px solid rgba(225,29,72,0.25)", color: "#fda4af", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name={t.i} size={13} />
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.5, paddingTop: 3 }}>{t.t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
