"use client";

import { useRef, useState, useEffect } from "react";

/* ── Icon ── */
export function Icon({ name, size = 18, stroke = 1.6, className = "" }: { name: string; size?: number; stroke?: number; className?: string }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  switch (name) {
    case "spark": return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case "scissors": return <svg {...p}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></svg>;
    case "wand": return <svg {...p}><path d="m15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM3 21l9-9M14 7l3 3"/></svg>;
    case "gauge": return <svg {...p}><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M12 4a8 8 0 0 0-8 8c0 2.21.9 4.21 2.34 5.66"/><path d="M19.66 17.66A8 8 0 0 0 12 4"/><path d="m13.5 10.5 3-3"/></svg>;
    case "arrow": return <svg {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case "upload": return <svg {...p}><path d="M12 16V4M6 10l6-6 6 6"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg>;
    case "image": return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>;
    case "download": return <svg {...p}><path d="M12 4v12M6 10l6 6 6-6"/><path d="M4 20h16"/></svg>;
    case "check": return <svg {...p}><path d="m5 12 5 5L20 7"/></svg>;
    case "refresh": return <svg {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>;
    case "shield": return <svg {...p}><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>;
    case "bolt": return <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>;
    case "qr": return (
      <svg {...p} stroke="none" fill="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth={stroke}/>
        <rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth={stroke}/>
        <rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth={stroke}/>
        <rect x="5" y="5" width="3" height="3" rx="0.5"/>
        <rect x="16" y="5" width="3" height="3" rx="0.5"/>
        <rect x="5" y="16" width="3" height="3" rx="0.5"/>
        <rect x="14" y="14" width="2.5" height="2.5" rx="0.5"/><rect x="17.5" y="14" width="2.5" height="2.5" rx="0.5"/>
        <rect x="14" y="17.5" width="2.5" height="2.5" rx="0.5"/><rect x="17.5" y="17.5" width="2.5" height="2.5" rx="0.5"/>
      </svg>
    );
    case "logo": return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#snapLg)"/>
        <path d="M8 14.5c0 1.4 1.4 2.5 4 2.5s4-1 4-2.4c0-3.2-7.5-2-7.5-5 0-1.2 1.2-2.1 3.4-2.1 2 0 3.4.8 3.6 2.1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
        <defs>
          <linearGradient id="snapLg" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0" stopColor="#f43f5e"/><stop offset="1" stopColor="#9f1239"/>
          </linearGradient>
        </defs>
      </svg>
    );
    default: return null;
  }
}

/* ── Ripple button ── */
export function Ripple({ children, className = "", style, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const dot = document.createElement("span");
    dot.className = "ripple-dot";
    dot.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 700);
    onClick?.(e);
  };
  return <button ref={ref} onClick={handle} className={`ripple-host ${className}`} style={style} {...rest}>{children}</button>;
}

/* ── Type-on text ── */
export function TypeOn({ text, speed = 38 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    const id = setInterval(() => { i++; setN(i); if (i >= text.length) clearInterval(id); }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span className={n < text.length ? "caret" : ""}>{text.slice(0, n)}</span>;
}

/* ── Count-up ── */
export function CountUp({ to = 0, duration = 1400 }: { to: number; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <span>{Math.round(v)}</span>;
}

/* ── Scroll reveal ── */
export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setVis(true), delay); obs.disconnect(); }
    }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [delay]);
  return <div ref={ref} className={`reveal ${vis ? "in" : ""} ${className}`}>{children}</div>;
}

/* ── Score ring ── */
export function ScoreRing({ value = 0, size = 140, stroke = 10 }: { value?: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb7185"/><stop offset="1" stopColor="#e11d48"/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none"/>
      <circle cx={size/2} cy={size/2} r={r} stroke="url(#ringGrad)" strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)", transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}/>
    </svg>
  );
}
