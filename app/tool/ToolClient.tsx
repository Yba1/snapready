"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { upload } from "@vercel/blob/client";
import { Icon, Ripple, TypeOn, CountUp, ScoreRing } from "../components/ui";

/* ── Types ── */
type Phase = "idle" | "uploading" | "starting" | "processing" | "done" | "error";
type SentinelStatus = "idle" | "scoring" | "done" | "error";
type ListingStatus = "idle" | "loading" | "done" | "error";
type DepopStatus = "idle" | "posting" | "posted" | "error";

interface Measurements { chest_cm: number | null; length_cm: number | null; sleeve_cm: number | null; notes: string; }
interface ListingData {
  brand: string | null; item_type: string;
  title: string; description: string; hashtags: string[];
  price_low: number; price_high: number; price_recommended: number;
  condition: string; visible_defects: string | null;
  measurements: Measurements | null;
}
type Section = "price" | "measurements" | "listing";
interface ImageJob {
  id: string; fileName: string; localPreview: string;
  phase: Phase; result: { originalUrl: string; processedUrl: string } | null; error: string | null;
  sentinelStatus: SentinelStatus; sentinelScore: number | null; sentinelVerdict: string | null;
  listingStatus: ListingStatus; listing: ListingData | null;
  openSections: Section[];
  depopStatus: DepopStatus; depopEditUrl: string | null;
}

function makeJob(file: File): ImageJob {
  return {
    id: crypto.randomUUID(), fileName: file.name, localPreview: URL.createObjectURL(file),
    phase: "idle", result: null, error: null,
    sentinelStatus: "idle", sentinelScore: null, sentinelVerdict: null,
    listingStatus: "idle", listing: null, openSections: [],
    depopStatus: "idle", depopEditUrl: null,
  };
}

/* ── Main component ── */
export default function ToolClient() {
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [depopToken, setDepopToken] = useState<string | null>(null);
  const [showDepopAuth, setShowDepopAuth] = useState(false);
  const [pendingDepopJobId, setPendingDepopJobId] = useState<string | null>(null);
  const sentinelTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timers = sentinelTimers.current;
    return () => { timers.forEach(t => clearTimeout(t)); };
  }, []);

  const processJob = useCallback(async (jobId: string, file: File, localPreview: string) => {
    const patch = (update: Partial<ImageJob>) =>
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...update } : j));

    try {
      patch({ phase: "uploading" });
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      const blobUrl = blob.url;

      patch({ phase: "starting" });
      const procRes = await fetch("/api/process", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: blobUrl }),
      });
      if (!procRes.ok) throw new Error("Failed to start processing");
      const { runId } = await procRes.json();

      patch({ phase: "processing" });
      let processedUrl: string | null = null;
      for (let attempts = 0; !processedUrl && attempts < 40; attempts++) {
        await new Promise(r => setTimeout(r, 3000));
        const pollRes = await fetch(`/api/runs/${runId}`);
        if (!pollRes.ok) throw new Error("Poll failed");
        const d = await pollRes.json();
        if (d.status_code === "succeeded") {
          processedUrl = d.output?.image_urls?.[0] ?? d.output?.outputs?.[0]?.url ?? (Array.isArray(d.output) ? d.output[0] : null);
          if (!processedUrl) throw new Error("No output URL");
        } else if (["failed", "cancelled"].includes(d.status_code)) {
          throw new Error(d.failure_message ?? "Processing failed");
        }
      }
      if (!processedUrl) throw new Error("Processing timed out");

      patch({ phase: "done", result: { originalUrl: localPreview, processedUrl }, sentinelStatus: "scoring" });

      try {
        const sentRes = await fetch("/api/sentinel/submit", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: processedUrl, originalUrl: blobUrl }),
        });
        if (!sentRes.ok) throw new Error("Sentinel failed");
        const { evalId } = await sentRes.json();
        if (!evalId) throw new Error("No eval ID");
        let attempts = 0;
        const pollSentinel = async () => {
          attempts++;
          try {
            const res = await fetch(`/api/sentinel/${evalId}`);
            const data = await res.json();
            if (data.status !== "running") {
              if (data.status === "completed") {
                patch({
                  sentinelScore: Math.round((data.weighted_pass_rate ?? data.score ?? 0) * 100),
                  sentinelVerdict: data.verdict ?? null, sentinelStatus: "done",
                });
              } else { patch({ sentinelStatus: "error" }); }
              return;
            }
            if (attempts < 16) sentinelTimers.current.set(jobId, setTimeout(pollSentinel, 15_000));
            else patch({ sentinelStatus: "error" });
          } catch { patch({ sentinelStatus: "error" }); }
        };
        sentinelTimers.current.set(jobId, setTimeout(pollSentinel, 25_000));
      } catch { patch({ sentinelStatus: "error" }); }
    } catch (err) {
      patch({ phase: "error", error: err instanceof Error ? err.message : "Something went wrong" });
    }
  }, []);

  const handleFiles = useCallback((files: File[]) => {
    const valid = files.filter(f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024).slice(0, 10);
    if (!valid.length) return;
    const newJobs = valid.map(makeJob);
    setJobs(prev => [...prev, ...newJobs]);
    newJobs.forEach((job, i) => processJob(job.id, valid[i], job.localPreview));
  }, [processJob]);

  const openSection = useCallback(async (job: ImageJob, section: Section) => {
    const { id: jobId, result, listing, listingStatus } = job;
    if (!result) return;

    // Always open the section immediately
    setJobs(prev => prev.map(j => j.id === jobId
      ? { ...j, openSections: j.openSections.includes(section) ? j.openSections : [...j.openSections, section] }
      : j
    ));

    // Skip fetch if already loaded or in flight
    if (listing || listingStatus !== "idle") return;

    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, listingStatus: "loading" } : j));
    try {
      const res = await fetch("/api/describe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: result.processedUrl }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const data = await res.json();
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, listing: data, listingStatus: "done" } : j));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, listingStatus: "error", error: msg } : j));
    }
  }, []);

  const requestDepopPost = useCallback((jobId: string) => {
    if (depopToken) {
      triggerDepopPost(jobId, depopToken);
    } else {
      setPendingDepopJobId(jobId);
      setShowDepopAuth(true);
    }
  }, [depopToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerDepopPost = useCallback(async (jobId: string, token: string) => {
    const job = await new Promise<ImageJob | undefined>(resolve =>
      setJobs(prev => { resolve(prev.find(j => j.id === jobId)); return prev.map(j => j.id === jobId ? { ...j, depopStatus: "posting" } : j); })
    );
    if (!job?.result || !job.listing) return;

    try {
      const res = await fetch("/api/depop/post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          imageUrl: job.result.processedUrl,
          title: job.listing.title,
          description: job.listing.description,
          hashtags: job.listing.hashtags,
          price: job.listing.price_recommended,
          condition: job.listing.condition,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Post failed");
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, depopStatus: "posted", depopEditUrl: data.editUrl } : j));
    } catch {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, depopStatus: "error" } : j));
    }
  }, []);

  const handleDepopAuth = useCallback(async (username: string, password: string): Promise<string | null> => {
    const res = await fetch("/api/depop/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Auth failed");
    setDepopToken(data.token);
    setShowDepopAuth(false);
    if (pendingDepopJobId) {
      triggerDepopPost(pendingDepopJobId, data.token);
      setPendingDepopJobId(null);
    }
    return data.token;
  }, [pendingDepopJobId, triggerDepopPost]);

  const generateShareCard = useCallback(async (job: ImageJob) => {
    if (!job.result) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0d0a0d"; ctx.fillRect(0, 0, 1080, 1080);

    const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => resolve(img); img.onerror = reject; img.src = src;
    });

    try {
      const [before, after] = await Promise.all([loadImg(job.result.originalUrl), loadImg(job.result.processedUrl)]);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 510, 1080); ctx.clip();
      ctx.filter = "brightness(0.65) saturate(0.6)";
      ctx.drawImage(before, 0, 0, 510, 1080); ctx.restore();
      ctx.fillStyle = "#f7f5f4"; ctx.fillRect(570, 0, 510, 1080);
      ctx.drawImage(after, 570, 0, 510, 1080);
      const grad = ctx.createLinearGradient(505, 0, 575, 0);
      grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(0.5, "rgba(225,29,72,0.9)"); grad.addColorStop(1, "rgba(247,245,244,0)");
      ctx.fillStyle = grad; ctx.fillRect(505, 0, 70, 1080);
      ctx.font = "bold 32px system-ui,sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillText("BEFORE", 24, 52);
      ctx.fillStyle = "rgba(10,10,10,0.75)"; ctx.fillText("AFTER", 594, 52);
      ctx.font = "22px system-ui,sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillText("snapready.vercel.app", 24, 1054);
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "snapready-share.png"; a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch {
      window.open(job.result.processedUrl, "_blank");
    }
  }, []);

  const downloadAll = useCallback(async () => {
    const done = jobs.filter(j => j.result?.processedUrl);
    if (!done.length) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    await Promise.all(done.map(async (job, i) => {
      try { const res = await fetch(job.result!.processedUrl); zip.file(`snapready-${i + 1}.png`, await res.blob()); } catch { /* skip */ }
    }));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "snapready-photos.zip"; a.click();
    URL.revokeObjectURL(url);
  }, [jobs]);

  const handleReset = useCallback(() => {
    sentinelTimers.current.forEach(t => clearTimeout(t)); sentinelTimers.current.clear();
    setJobs(prev => { prev.forEach(j => URL.revokeObjectURL(j.localPreview)); return []; });
  }, []);

  const doneCount = jobs.filter(j => j.phase === "done").length;

  return (
    <div className="page-enter page-outer" style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px 80px" }}>
      <ToolNav />
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) handleFiles(f); e.target.value = ""; }} />

      {showDepopAuth && (
        <DepopAuthModal
          onAuth={handleDepopAuth}
          onClose={() => { setShowDepopAuth(false); setPendingDepopJobId(null); }}
        />
      )}

      {jobs.length === 0 ? (
        <div style={{ maxWidth: 680, margin: "40px auto 0" }}>
          <Dropzone onFiles={handleFiles} onPickFiles={() => fileInputRef.current?.click()} />
        </div>
      ) : (
        <BatchView
          jobs={jobs} doneCount={doneCount} depopToken={depopToken}
          onReset={handleReset} onAddMore={() => fileInputRef.current?.click()}
          onDownloadAll={downloadAll} onOpenSection={(job, section) => openSection(job, section)}
          onPostToDepop={requestDepopPost} onShareCard={generateShareCard}
        />
      )}
    </div>
  );
}

/* ── Tool nav ── */
function ToolNav() {
  return (
    <div style={{ position: "sticky", top: 14, zIndex: 30, marginTop: 14 }}>
      <div className="glass" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 10px 18px", borderRadius: 999, background: "rgba(12,10,12,0.55)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <Icon name="logo" size={26} />
          <span style={{ fontWeight: 700, letterSpacing: "-0.02em", fontSize: 16 }}>SnapReady</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", border: "1px solid var(--line)", padding: "2px 7px", borderRadius: 999, marginLeft: 4 }}>STUDIO</span>
        </Link>
        <div className="mono nav-secondary" style={{ fontSize: 11, color: "var(--ink-faint)" }}>3 photos free today</div>
        <button className="pill pill-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>
          <Icon name="bolt" size={13} /> Upgrade
        </button>
      </div>
    </div>
  );
}

/* ── Depop auth modal ── */
function DepopAuthModal({ onAuth, onClose }: { onAuth: (u: string, p: string) => Promise<string | null>; onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!username || !password) return;
    setLoading(true); setError(null);
    try { await onAuth(username, password); }
    catch (err) { setError(err instanceof Error ? err.message : "Auth failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass" style={{ width: "100%", maxWidth: 400, borderRadius: 24, padding: 32, margin: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>Connect Depop</div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 3 }}>Post your listing as a draft directly</div>
          </div>
          <button onClick={onClose} style={{ color: "var(--ink-faint)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="text" placeholder="Depop username" value={username}
            onChange={e => setUsername(e.target.value)}
            style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid var(--line)", color: "var(--ink)", fontSize: 14, outline: "none" }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid var(--line)", color: "var(--ink)", fontSize: 14, outline: "none" }}
          />
        </div>

        {error && <div style={{ marginTop: 10, fontSize: 12, color: "#fda4af", background: "rgba(225,29,72,0.08)", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}

        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 12, lineHeight: 1.5 }}>
          Credentials are sent directly to Depop and never stored. Your listing is saved as a draft so you can review before publishing.
        </div>

        <Ripple className="pill pill-rose" onClick={submit} style={{ width: "100%", justifyContent: "center", marginTop: 20, padding: "13px", fontSize: 14 }} disabled={loading}>
          {loading ? <><span className="dots"><span /><span /><span /></span> Connecting…</> : "Connect & post"}
        </Ripple>
      </div>
    </div>
  );
}

/* ── Dropzone ── */
function Dropzone({ onFiles, onPickFiles }: { onFiles: (f: File[]) => void; onPickFiles: () => void }) {
  const [drag, setDrag] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <div className="glass"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); onFiles(Array.from(e.dataTransfer.files)); }}
      style={{
        position: "relative", borderRadius: 24, padding: 36, minHeight: 440,
        background: drag ? "linear-gradient(180deg,rgba(225,29,72,0.12),rgba(225,29,72,0.04))" : "linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))",
        boxShadow: drag ? "0 0 0 1px rgba(225,29,72,0.6),0 0 80px -10px rgba(225,29,72,0.5)" : "none",
        transition: "background .3s ease,box-shadow .3s ease", overflow: "hidden",
      }}>
      <div className={`dash-rot${hover || drag ? " fast" : ""}`} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 20px" }}>
        <div style={{
          width: 84, height: 84, borderRadius: 24,
          background: drag ? "linear-gradient(180deg,#fb7185,#e11d48)" : "linear-gradient(180deg,rgba(225,29,72,0.22),rgba(225,29,72,0.05))",
          border: "1px solid rgba(225,29,72,0.35)", color: drag ? "white" : "#fda4af",
          display: "grid", placeItems: "center", marginBottom: 28,
          transform: drag ? "scale(1.06)" : "none",
          transition: "all .3s cubic-bezier(.2,.7,.2,1)",
          boxShadow: drag ? "0 20px 40px -10px rgba(225,29,72,0.6)" : "none",
        }}>
          <Icon name="upload" size={34} stroke={1.8} />
        </div>
        <div style={{ fontSize: 30, letterSpacing: "-0.02em", fontWeight: 600 }}>
          {drag ? "Let go to clean them." : "Drop photos here."}
        </div>
        <div style={{ color: "var(--ink-dim)", marginTop: 10, fontSize: 15, maxWidth: 360, lineHeight: 1.55 }}>
          Up to 10 photos at once. JPG, PNG, WEBP — backgrounds removed and cropped to 1:1.
        </div>
        <Ripple className="pill pill-rose" onClick={onPickFiles} style={{ padding: "12px 20px", fontSize: 14, marginTop: 28 }}>
          <Icon name="image" size={14} /> Choose from device
        </Ripple>
        <div className="mono" style={{ display: "flex", gap: 20, marginTop: 32, fontSize: 11, color: "var(--ink-faint)", flexWrap: "wrap", justifyContent: "center" }}>
          <span><Icon name="shield" size={11} /> Photos auto-deleted in 24h</span>
          <span>·</span>
          <span>No watermark on export</span>
        </div>
      </div>
    </div>
  );
}

/* ── Batch view ── */
function BatchView({ jobs, doneCount, depopToken, onReset, onAddMore, onDownloadAll, onOpenSection, onPostToDepop, onShareCard }: {
  jobs: ImageJob[]; doneCount: number; depopToken: string | null;
  onReset: () => void; onAddMore: () => void; onDownloadAll: () => void;
  onOpenSection: (job: ImageJob, section: Section) => void;
  onPostToDepop: (jobId: string) => void;
  onShareCard: (job: ImageJob) => void;
}) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>{doneCount} of {jobs.length} ready</span>
          <span style={{ fontSize: 13, color: "var(--ink-faint)", marginLeft: 12 }}>{doneCount < jobs.length ? "Processing…" : "All done!"}</span>
          {depopToken && <span style={{ fontSize: 11, color: "#86efac", marginLeft: 12 }} className="mono">● Depop connected</span>}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="pill pill-ghost" onClick={onAddMore} style={{ padding: "8px 14px", fontSize: 13 }}>
            <Icon name="image" size={13} /> Add more
          </button>
          {doneCount > 1 && (
            <Ripple className="pill pill-rose" onClick={onDownloadAll} style={{ padding: "8px 14px", fontSize: 13 }}>
              <Icon name="download" size={13} /> Download all ({doneCount})
            </Ripple>
          )}
          <button onClick={onReset} className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-faint)", cursor: "pointer" }}>
            <Icon name="refresh" size={12} /> Start over
          </button>
        </div>
      </div>
      <div className="batch-grid">
        {jobs.map(job => (
          <JobCard key={job.id} job={job}
            onOpenSection={onOpenSection}
            onPostToDepop={onPostToDepop}
            onShareCard={onShareCard}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Job card ── */
function JobCard({ job, onOpenSection, onPostToDepop, onShareCard }: {
  job: ImageJob;
  onOpenSection: (job: ImageJob, section: Section) => void;
  onPostToDepop: (jobId: string) => void;
  onShareCard: (job: ImageJob) => void;
}) {
  const [showQR, setShowQR] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [bg, setBg] = useState<"clean" | "rose" | "studio">("clean");
  const bgMap = { clean: "linear-gradient(180deg,#f7f5f4,#ede9e6)", rose: "linear-gradient(160deg,#f9c8d1,#fff)", studio: "linear-gradient(180deg,#1a1517,#0a0707)" };
  const stepMap: Record<string, number> = { uploading: 0, starting: 1, processing: 2 };
  const textMap: Record<string, string> = { uploading: "Uploading…", starting: "Starting AI…", processing: "Removing background…" };
  const isProcessing = job.phase === "uploading" || job.phase === "starting" || job.phase === "processing";

  return (
    <div className="glass" style={{ borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.fileName}</span>
        {job.phase === "done" && <span className="mono" style={{ fontSize: 10, color: "#86efac", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", padding: "2px 8px", borderRadius: 999 }}>DONE</span>}
        {job.phase === "error" && <span className="mono" style={{ fontSize: 10, color: "#fda4af", background: "rgba(225,29,72,0.12)", border: "1px solid rgba(225,29,72,0.3)", padding: "2px 8px", borderRadius: 999 }}>ERROR</span>}
        {isProcessing && <span className="mono" style={{ fontSize: 10, color: "var(--rose-soft)", background: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.2)", padding: "2px 8px", borderRadius: 999 }}>STEP {(stepMap[job.phase] ?? 0) + 1}/3</span>}
      </div>

      {/* Processing */}
      {isProcessing && (
        <div style={{ padding: 16 }}>
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "1/1", background: "#15101a" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={job.localPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.3, filter: "blur(3px)" }} />
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <div style={{ position: "relative", width: 52, height: 52 }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(225,29,72,0.15)", borderTopColor: "#e11d48", animation: "spin 1.1s linear infinite", boxShadow: "0 0 20px rgba(225,29,72,0.4)" }} />
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fda4af" }}><Icon name="spark" size={16} /></div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 14, fontWeight: 500 }}><TypeOn key={job.phase} text={textMap[job.phase] ?? "Processing…"} speed={30} /></div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 2, borderRadius: 999, background: i <= (stepMap[job.phase] ?? 0) ? "linear-gradient(90deg,#fb7185,#e11d48)" : "rgba(255,255,255,0.08)", transition: "background .4s ease" }} />)}
          </div>
        </div>
      )}

      {/* Error */}
      {job.phase === "error" && (
        <div style={{ padding: 16 }}>
          <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "1/1" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={job.localPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.25 }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#fda4af" }}>{job.error}</div>
        </div>
      )}

      {/* Done */}
      {job.phase === "done" && job.result && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          {/* Before / After */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "1/1", position: "relative" }}>
              <span className="mono" style={{ position: "absolute", top: 6, left: 6, fontSize: 9, background: "rgba(0,0,0,0.55)", color: "white", padding: "2px 6px", borderRadius: 999, zIndex: 2 }}>BEFORE</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={job.result.originalUrl} alt="Before" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.8) saturate(0.8)" }} />
            </div>
            <div className="checker" style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "1/1", position: "relative" }}>
              <span className="mono" style={{ position: "absolute", top: 6, left: 6, fontSize: 9, background: "rgba(255,255,255,0.9)", color: "#0a0a0a", padding: "2px 6px", borderRadius: 999, zIndex: 3 }}>AFTER</span>
              <div style={{ position: "absolute", inset: 0, background: bgMap[bg], transition: "background .4s ease" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={job.result.processedUrl} alt="After" style={{ position: "relative", zIndex: 1, width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          </div>

          {/* Background swatches */}
          <div style={{ display: "flex", gap: 6 }}>
            {([{ id: "clean" as const, s: "linear-gradient(180deg,#f7f5f4,#ede9e6)" }, { id: "rose" as const, s: "linear-gradient(160deg,#f9c8d1,#fff)" }, { id: "studio" as const, s: "linear-gradient(180deg,#1a1517,#0a0707)" }]).map(o => (
              <button key={o.id} onClick={() => setBg(o.id)} style={{ width: 22, height: 22, borderRadius: 999, background: o.s, cursor: "pointer", border: `2px solid ${bg === o.id ? "#e11d48" : "rgba(255,255,255,0.15)"}`, transition: "border-color .2s", flexShrink: 0 }} />
            ))}
          </div>

          {/* Primary actions */}
          <Ripple className="pill pill-rose" style={{ padding: "9px 14px", fontSize: 13, width: "100%", justifyContent: "center" }}
            onClick={() => { setDownloaded(true); setTimeout(() => setDownloaded(false), 1800); window.open(job.result!.processedUrl, "_blank"); }}>
            {downloaded ? <><Icon name="check" size={13} /> Saved!</> : <><Icon name="download" size={13} /> Download</>}
          </Ripple>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button className="pill pill-ghost" style={{ padding: "7px 12px", fontSize: 12, justifyContent: "center" }} onClick={() => setShowQR(v => !v)}>
              <Icon name="qr" size={13} /> QR code
            </button>
            <button className="pill pill-ghost" style={{ padding: "7px 12px", fontSize: 12, justifyContent: "center" }} onClick={() => onShareCard(job)}>
              <Icon name="image" size={12} /> Share card
            </button>
          </div>

          {/* AI section buttons */}
          {(() => {
            const loading = job.listingStatus === "loading";
            const btn = (section: Section, label: string, icon: string) => {
              const open = job.openSections.includes(section);
              const isLoading = loading && !job.listing;
              return (
                <button key={section} className="pill pill-ghost"
                  style={{ padding: "8px 10px", fontSize: 12, justifyContent: "center", opacity: isLoading && !open ? 0.5 : 1, flex: 1 }}
                  onClick={() => onOpenSection(job, section)}
                  disabled={isLoading}>
                  {isLoading && !open
                    ? <><span className="dots"><span /><span /><span /></span></>
                    : open && job.listing
                    ? <><Icon name="check" size={11} /> {label}</>
                    : <><Icon name={icon} size={11} /> {label}</>}
                </button>
              );
            };
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {btn("price", "Price", "bolt")}
                {btn("measurements", "Measure", "shield")}
                {btn("listing", "Write listing", "image")}
              </div>
            );
          })()}

          {job.listingStatus === "error" && (
            <div style={{ fontSize: 12, color: "#fda4af", padding: "8px 12px", borderRadius: 10, background: "rgba(225,29,72,0.08)" }}>
              AI failed — check ANTHROPIC_API_KEY in Vercel env vars.
            </div>
          )}

          {/* QR panel */}
          {showQR && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)" }}>
              <div style={{ background: "white", padding: 12, borderRadius: 10 }}>
                <QRCode value={job.result.processedUrl} size={140} />
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)", textAlign: "center" }}>Scan to download on your phone</div>
            </div>
          )}



          {/* Price section */}
          {job.openSections.includes("price") && job.listing && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--rose-soft)", letterSpacing: "0.12em" }}>PRICE ESTIMATE</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>£{job.listing.price_recommended}</span>
                <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>recommended</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Range: £{job.listing.price_low} – £{job.listing.price_high}</div>
            </div>
          )}

          {/* Measurements section */}
          {job.openSections.includes("measurements") && job.listing && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--rose-soft)", letterSpacing: "0.12em" }}>MEASUREMENTS (est.)</div>
              {job.listing.measurements && (job.listing.measurements.chest_cm || job.listing.measurements.length_cm || job.listing.measurements.sleeve_cm) ? (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {job.listing.measurements.chest_cm && <div><div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)", marginBottom: 2 }}>CHEST</div><div style={{ fontSize: 18, fontWeight: 600 }}>{job.listing.measurements.chest_cm}<span style={{ fontSize: 11, color: "var(--ink-faint)" }}>cm</span></div></div>}
                  {job.listing.measurements.length_cm && <div><div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)", marginBottom: 2 }}>LENGTH</div><div style={{ fontSize: 18, fontWeight: 600 }}>{job.listing.measurements.length_cm}<span style={{ fontSize: 11, color: "var(--ink-faint)" }}>cm</span></div></div>}
                  {job.listing.measurements.sleeve_cm && <div><div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)", marginBottom: 2 }}>SLEEVE</div><div style={{ fontSize: 18, fontWeight: 600 }}>{job.listing.measurements.sleeve_cm}<span style={{ fontSize: 11, color: "var(--ink-faint)" }}>cm</span></div></div>}
                </div>
              ) : <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Couldn't estimate — item not laid flat</div>}
              {job.listing.measurements?.notes && <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{job.listing.measurements.notes}</div>}
            </div>
          )}

          {/* Listing section */}
          {job.openSections.includes("listing") && job.listing && (
            <ListingPanel listing={job.listing} jobId={job.id} depopStatus={job.depopStatus} depopEditUrl={job.depopEditUrl} onPostToDepop={onPostToDepop} />
          )}

          {/* Sentinel */}
          {job.sentinelStatus === "done" && job.sentinelScore !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)" }}>
              <ScoreRing value={job.sentinelScore} size={42} stroke={5} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}><CountUp to={job.sentinelScore} duration={1000} /><span style={{ fontSize: 11, color: "var(--ink-faint)" }}>/100</span></div>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)" }}>AI QUALITY</div>
              </div>
              {job.sentinelVerdict && (
                <div className="mono" style={{ marginLeft: "auto", fontSize: 9, padding: "2px 8px", borderRadius: 999, background: job.sentinelVerdict === "pass" ? "rgba(34,197,94,0.12)" : "rgba(225,29,72,0.12)", color: job.sentinelVerdict === "pass" ? "#86efac" : "#fda4af", border: `1px solid ${job.sentinelVerdict === "pass" ? "rgba(34,197,94,0.3)" : "rgba(225,29,72,0.3)"}` }}>
                  {job.sentinelVerdict === "pass" ? "READY" : job.sentinelVerdict === "soft_fail" ? "SOFT FAIL" : "RESHOOT"}
                </div>
              )}
            </div>
          )}
          {job.sentinelStatus === "scoring" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-faint)" }}>
              <span className="dots"><span /><span /><span /></span> Scoring quality…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Listing panel ── */
function ListingPanel({ listing, jobId, depopStatus, depopEditUrl, onPostToDepop }: {
  listing: ListingData; jobId: string;
  depopStatus: DepopStatus; depopEditUrl: string | null;
  onPostToDepop: (jobId: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)" }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--rose-soft)", letterSpacing: "0.12em" }}>DEPOP LISTING</div>

      {/* Title */}
      <div>
        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginBottom: 3 }}>Title</div>
        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{listing.title}</div>
      </div>

      {/* Description */}
      <div>
        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginBottom: 3 }}>Description</div>
        <div style={{ fontSize: 12, color: "var(--ink-dim)", lineHeight: 1.55 }}>{listing.description}</div>
      </div>

      {/* Hashtags */}
      <div>
        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginBottom: 5 }}>Hashtags — tap one to copy</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {listing.hashtags.map((tag, i) => (
            <button key={i} onClick={() => copy(`#${tag}`, `t${i}`)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, cursor: "pointer", background: copied === `t${i}` ? "rgba(34,197,94,0.12)" : "rgba(225,29,72,0.08)", border: `1px solid ${copied === `t${i}` ? "rgba(34,197,94,0.3)" : "rgba(225,29,72,0.2)"}`, color: copied === `t${i}` ? "#86efac" : "#fda4af" }}>
              {copied === `t${i}` ? "✓" : "#"}{tag}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: "var(--line-2)" }} />

      {/* Individual copy buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <button className="pill pill-ghost" style={{ padding: "7px 8px", fontSize: 11, justifyContent: "center" }} onClick={() => copy(listing.title, "title")}>
          {copied === "title" ? <><Icon name="check" size={11} /> Title</> : "Copy title"}
        </button>
        <button className="pill pill-ghost" style={{ padding: "7px 8px", fontSize: 11, justifyContent: "center" }} onClick={() => copy(listing.description, "desc")}>
          {copied === "desc" ? <><Icon name="check" size={11} /> Desc</> : "Copy desc"}
        </button>
        <button className="pill pill-ghost" style={{ padding: "7px 8px", fontSize: 11, justifyContent: "center" }} onClick={() => copy(listing.hashtags.map(t => `#${t}`).join(" "), "tags")}>
          {copied === "tags" ? <><Icon name="check" size={11} /> Tags</> : "Copy tags"}
        </button>
      </div>

      {/* Post to Depop */}
      {depopStatus === "posted" && depopEditUrl ? (
        <a href={depopEditUrl} target="_blank" rel="noopener noreferrer" className="pill pill-ghost" style={{ display: "flex", justifyContent: "center", padding: "9px 14px", fontSize: 13, color: "#86efac", borderColor: "rgba(34,197,94,0.3)" }}>
          <Icon name="check" size={13} /> Draft saved — review on Depop ↗
        </a>
      ) : depopStatus === "posting" ? (
        <div className="pill pill-ghost" style={{ display: "flex", justifyContent: "center", padding: "9px 14px", fontSize: 13, opacity: 0.6 }}>
          <span className="dots"><span /><span /><span /></span> Posting to Depop…
        </div>
      ) : (
        <Ripple className="pill pill-rose" style={{ width: "100%", justifyContent: "center", padding: "9px 14px", fontSize: 13 }} onClick={() => onPostToDepop(jobId)}>
          Post to Depop
        </Ripple>
      )}

      {/* Depop error → show copy fallback */}
      {depopStatus === "error" && (
        <div style={{ fontSize: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.2)" }}>
          <div style={{ color: "#fda4af", marginBottom: 8 }}>Depop post failed — copy the sections above instead.</div>
        </div>
      )}
    </div>
  );
}
