"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Icon, Ripple, Reveal } from "./components/ui";

export default function LandingClient() {
  return (
    <div className="page-enter page-outer" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px" }}>
      <Nav />
      <Hero />
      <SocialStrip />
      <Features />
      <HowItWorks />
      <BigCTA />
      <Footer />
    </div>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div style={{ position: "sticky", top: 14, zIndex: 30, marginTop: 14 }}>
      <div className="glass" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 10px 18px", borderRadius: 999,
        background: scrolled ? "rgba(12,10,12,0.65)" : "rgba(255,255,255,0.04)",
        boxShadow: scrolled ? "0 12px 40px -16px rgba(0,0,0,0.6)" : "none",
        transition: "all .35s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="logo" size={28} />
          <span style={{ fontWeight: 700, letterSpacing: "-0.02em", fontSize: 17 }}>SnapReady</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", border: "1px solid var(--line)", padding: "2px 7px", borderRadius: 999, marginLeft: 4 }}>BETA</span>
        </div>
        <div className="nav-mid" style={{ display: "flex", gap: 24, color: "var(--ink-dim)", fontSize: 14 }}>
          <a href="#features" style={{ transition: "color .2s", cursor: "pointer" }}>Features</a>
          <a href="#how" style={{ transition: "color .2s", cursor: "pointer" }}>How it works</a>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/tool" className="pill pill-ghost nav-secondary" style={{ padding: "8px 16px", fontSize: 13 }}>Open tool</Link>
          <Ripple className="pill pill-rose" style={{ padding: "8px 16px", fontSize: 13 }}>
            <Link href="/tool" style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}>
              Try it free <Icon name="arrow" size={13} />
            </Link>
          </Ripple>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section style={{ paddingTop: 90, paddingBottom: 40 }}>
      <div className="hero-grid">
        <div>
          <div className="fade-up d1 mono" style={{
            display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink-dim)",
            background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)",
            padding: "6px 12px", borderRadius: 999, marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
            NEW · AI background removal for resale photos
          </div>
          <h1 className="fade-up d2" style={{
            fontSize: "clamp(48px,6.2vw,88px)", lineHeight: 0.98, margin: 0,
            letterSpacing: "-0.04em", fontWeight: 600,
          }}>
            Marketplace photos<br />
            that <span className="shimmer">actually</span> sell.
          </h1>
          <p className="fade-up d3" style={{
            color: "var(--ink-dim)", fontSize: 19, lineHeight: 1.5, maxWidth: 520, marginTop: 26, letterSpacing: "-0.01em",
          }}>
            Drop in a sloppy phone pic. Get back a studio-clean listing photo ready for Depop's square format.
          </p>
          <div className="fade-up d4" style={{ display: "flex", gap: 12, marginTop: 36 }}>
            <Ripple className="pill pill-rose" style={{ padding: "14px 22px", fontSize: 15 }}>
              <Link href="/tool" style={{ display: "flex", alignItems: "center", gap: 7, color: "inherit", textDecoration: "none" }}>
                Clean a photo <Icon name="arrow" size={14} />
              </Link>
            </Ripple>
          </div>
          <div className="fade-up d5" style={{ display: "flex", gap: 24, marginTop: 44, color: "var(--ink-faint)", fontSize: 12 }}>
            {["No card required", "Free to use", "Ready in ~15s"].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="check" size={13} />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="fade-up d3 hide-mobile"><PhoneShowcase /></div>
      </div>
    </section>
  );
}

function PhoneShowcase() {
  const [wipe, setWipe] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    let t0: number | null = null;
    const loop = (t: number) => {
      if (!t0) t0 = t;
      const dur = 6000;
      const p = ((t - t0) % dur) / dur;
      let w: number;
      if (p < 0.15) w = 0;
      else if (p < 0.5) w = ((p - 0.15) / 0.35) * 100;
      else if (p < 0.65) w = 100;
      else w = (1 - (p - 0.65) / 0.35) * 100;
      setWipe(w);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const jacketImg = "https://images.unsplash.com/photo-1695335753484-a677d447159c?fm=jpg&q=70&w=800&auto=format&fit=crop";

  return (
    <div className="float" style={{ position: "relative", margin: "0 auto", width: 300 }}>
      <div style={{
        position: "absolute", inset: -40, borderRadius: 80, zIndex: 0,
        background: "radial-gradient(60% 60% at 50% 50%,rgba(225,29,72,0.35),transparent 70%)",
        filter: "blur(20px)",
      }} />
      <div style={{
        position: "relative", width: 300, height: 600, borderRadius: 42,
        background: "linear-gradient(180deg,#1a1517,#0e0a0c)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 60px 100px -40px rgba(0,0,0,0.7),inset 0 0 0 1px rgba(255,255,255,0.04)",
        padding: 9, zIndex: 1,
      }}>
        <div style={{ position: "absolute", left: "50%", top: 14, transform: "translateX(-50%)", width: 90, height: 24, background: "#000", borderRadius: 12, zIndex: 3 }} />
        <div style={{ width: "100%", height: "100%", borderRadius: 34, overflow: "hidden", position: "relative", background: "#0a0707" }}>
          <div style={{ position: "absolute", top: 16, left: 24, right: 24, display: "flex", justifyContent: "space-between", color: "white", fontSize: 11, fontWeight: 600, zIndex: 4 }}>
            <span>9:41</span><span style={{ opacity: 0.7 }}>5G ●●●●</span>
          </div>
          <div style={{ position: "absolute", inset: 0, paddingTop: 48 }}>
            <div style={{ position: "relative", height: 320, margin: "0 12px", borderRadius: 16, overflow: "hidden" }}>
              {/* BEFORE */}
              <div style={{ position: "absolute", inset: 0, filter: "brightness(0.55) contrast(0.85) saturate(0.7)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={jacketImg} alt="before" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 50% at 50% 50%,transparent 40%,rgba(0,0,0,0.5) 100%)" }} />
              </div>
              {/* AFTER */}
              <div style={{
                position: "absolute", inset: 0,
                clipPath: `inset(0 ${100 - wipe}% 0 0)`,
                transition: "clip-path .05s linear",
                background: "linear-gradient(180deg,#f7f5f4,#ede9e6)",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={jacketImg} alt="after" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              {wipe > 0.5 && wipe < 99.5 && (
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${wipe}%`, width: 2, background: "linear-gradient(180deg,transparent,#fb7185,transparent)", boxShadow: "0 0 20px #e11d48" }} />
              )}
              <div className="mono" style={{ position: "absolute", top: 10, left: 10, fontSize: 9, color: "white", background: "rgba(0,0,0,0.55)", padding: "2px 7px", borderRadius: 999 }}>BEFORE</div>
              <div className="mono" style={{ position: "absolute", top: 10, right: 10, fontSize: 9, color: "#0a0a0a", background: "rgba(255,255,255,0.95)", padding: "2px 7px", borderRadius: 999, opacity: wipe / 100 }}>AFTER</div>
            </div>
            <div style={{ padding: "14px 18px 0", color: "white" }}>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Carhartt detroit jacket · brown</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>vintage · size M · y2k workwear</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <div style={{ fontSize: 19, fontWeight: 700 }}>£84</div>
                <div style={{ fontSize: 10, color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", padding: "2px 7px", borderRadius: 999 }}>↑ 3.2× CTR est.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FloatChip x={-28} y={100} delay={0.3}><Icon name="scissors" size={11} /> bg removed</FloatChip>
      <FloatChip x={272} y={240} delay={0.6} dark><span className="mono" style={{ fontSize: 9 }}>SCORE</span><strong style={{ fontSize: 15 }}>92</strong></FloatChip>
      <FloatChip x={-44} y={400} delay={0.9}><Icon name="wand" size={11} /> caption ready</FloatChip>
    </div>
  );
}

function FloatChip({ children, x, y, delay = 0, dark = false }: { children: React.ReactNode; x: number; y: number; delay?: number; dark?: boolean }) {
  return (
    <div className="glass float fade-up d4" style={{
      position: "absolute", left: x, top: y, zIndex: 2,
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "7px 12px", borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: dark ? "rgba(10,10,10,0.75)" : "rgba(255,255,255,0.08)",
      animationDelay: `${delay}s`,
    }}>{children}</div>
  );
}

function SocialStrip() {
  const items = ["thrift kids", "rerack", "vault04", "cassette.fits", "midcity vintage", "harlow archive"];
  return (
    <div style={{ padding: "60px 0 20px", borderTop: "1px solid var(--line-2)", borderBottom: "1px solid var(--line-2)", margin: "60px 0 0" }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", textAlign: "center", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
        Trusted by 4,200+ resellers shifting 50k+ items a week
      </div>
      <div style={{ display: "flex", gap: 48, justifyContent: "center", flexWrap: "wrap", color: "var(--ink-faint)", fontSize: 15, fontWeight: 500 }}>
        {items.map((i) => <span key={i}>{i}</span>)}
      </div>
    </div>
  );
}

function Features() {
  const cards = [
    { icon: "scissors", title: "Background, gone.", body: "One tap removes whatever's behind your fit — bed, carpet, dorm. Crop to Depop's 1:1 square in the same pass." },
    { icon: "gauge", title: "Score before you post.", body: "Our AI rates light, framing, focus, and clutter 0–100. See what to reshoot before a buyer scrolls past." },
    { icon: "wand", title: "Captions that convert.", body: "Tag the era, the silhouette, the search terms. Pulled from the listings that actually moved this week." },
  ];
  return (
    <section id="features" style={{ padding: "120px 0 60px" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 56, flexWrap: "wrap", gap: 20 }}>
          <h2 style={{ fontSize: "clamp(32px,4vw,44px)", margin: 0, letterSpacing: "-0.03em", fontWeight: 600, maxWidth: 540 }}>
            Built for the <span className="serif" style={{ color: "#fb7185" }}>3-second scroll</span>.
          </h2>
          <div style={{ color: "var(--ink-dim)", fontSize: 14, maxWidth: 300 }}>
            Buyers decide on the thumbnail. Everything we ship is about winning that one tap.
          </div>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
        {cards.map((c, i) => <Reveal key={c.title} delay={i * 110}><FeatureCard {...c} /></Reveal>)}
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="glass"
      style={{
        padding: 28, borderRadius: 20, position: "relative", overflow: "hidden", minHeight: 240,
        transform: hover ? "translateY(-6px)" : "none",
        transition: "transform .5s cubic-bezier(.2,.7,.2,1),background .3s ease",
        background: hover ? "linear-gradient(180deg,rgba(225,29,72,0.08),rgba(255,255,255,0.025))" : undefined,
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: "linear-gradient(180deg,rgba(225,29,72,0.25),rgba(225,29,72,0.05))",
        border: "1px solid rgba(225,29,72,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fda4af", marginBottom: 20,
      }}>
        <Icon name={icon} size={22} />
      </div>
      <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 10 }}>{title}</div>
      <div style={{ color: "var(--ink-dim)", fontSize: 14, lineHeight: 1.6 }}>{body}</div>
      <div style={{
        position: "absolute", right: -60, bottom: -60, width: 180, height: 180,
        background: "radial-gradient(circle,rgba(225,29,72,0.35),transparent 70%)",
        opacity: hover ? 0.7 : 0.15, transition: "opacity .4s ease", filter: "blur(10px)",
      }} />
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Drop the photo", d: "Drag any phone pic in — clutter and all. JPG, PNG, WEBP up to 10 MB." },
    { n: "02", t: "AI cleans it", d: "Background removed, cropped to Depop's 1:1 square. ~15 seconds." },
    { n: "03", t: "Download & list", d: "Export directly to your listing. No watermark, no signup." },
  ];
  return (
    <section id="how" style={{ padding: "60px 0 80px" }}>
      <Reveal>
        <div style={{ marginBottom: 48 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--rose-soft)", letterSpacing: "0.15em" }}>HOW IT WORKS</div>
          <h2 style={{ fontSize: "clamp(28px,3.5vw,38px)", letterSpacing: "-0.03em", margin: "10px 0 0", fontWeight: 600 }}>Three steps. One better listing.</h2>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 0, position: "relative" }}>
        <div className="how-connector" style={{ position: "absolute", top: 28, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg,transparent,rgba(225,29,72,0.45),rgba(225,29,72,0.45),transparent)" }} />
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 120}>
            <div style={{ padding: "0 24px" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 999,
                background: "rgba(225,29,72,0.15)", border: "1px solid rgba(225,29,72,0.4)",
                color: "#fb7185", fontFamily: "var(--font-geist-mono)", fontWeight: 500,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", zIndex: 1, backdropFilter: "blur(10px)",
              }}>{s.n}</div>
              <div style={{ fontSize: 19, fontWeight: 600, marginTop: 20, letterSpacing: "-0.01em" }}>{s.t}</div>
              <div style={{ color: "var(--ink-dim)", marginTop: 8, fontSize: 14, lineHeight: 1.6, maxWidth: 260 }}>{s.d}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function BigCTA() {
  return (
    <section style={{ padding: "80px 0 100px" }}>
      <Reveal>
        <div className="glass cta-inner" style={{
          borderRadius: 28, position: "relative", overflow: "hidden",
          background: "linear-gradient(180deg,rgba(225,29,72,0.10),rgba(255,255,255,0.02))",
          textAlign: "center",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 60% at 50% 0%,rgba(225,29,72,0.25),transparent 70%)", pointerEvents: "none" }} />
          <h2 style={{ fontSize: "clamp(32px,5vw,60px)", letterSpacing: "-0.03em", margin: 0, fontWeight: 600, lineHeight: 1.05 }}>
            Your next listing could<br />be your fastest sale.
          </h2>
          <div style={{ color: "var(--ink-dim)", marginTop: 16, fontSize: 16 }}>Free to use. No signup required.</div>
          <div style={{ marginTop: 30, display: "flex", justifyContent: "center" }}>
            <Ripple className="pill pill-rose" style={{ padding: "16px 26px", fontSize: 15 }}>
              <Link href="/tool" style={{ display: "flex", alignItems: "center", gap: 7, color: "inherit", textDecoration: "none" }}>
                Clean a photo now <Icon name="arrow" size={14} />
              </Link>
            </Ripple>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: "40px 0 80px", borderTop: "1px solid var(--line-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="logo" size={20} />
          <span style={{ fontWeight: 600 }}>SnapReady</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: 10 }}>© 2026 Runflow Labs</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink-faint)" }} className="mono">
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "#e11d48", boxShadow: "0 0 8px #e11d48", display: "inline-block", animation: "pillPulse 2s ease-in-out infinite" }} />
          Powered by Runflow AI
        </div>
      </div>
    </footer>
  );
}
