import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <span className="font-semibold text-lg tracking-tight">SnapReady</span>
        <Link
          href="/tool"
          className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors"
        >
          Try it free →
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-rose-600 bg-rose-50 px-3 py-1 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          Free while in beta
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 max-w-2xl leading-tight mb-6">
          Depop photos that{" "}
          <span className="text-rose-600">actually sell</span>
        </h1>

        <p className="text-lg text-gray-500 max-w-lg mb-10">
          Upload your product photo. We remove the background and crop it to
          Depop&apos;s square format. Done in seconds.
        </p>

        <Link
          href="/tool"
          className="inline-flex items-center gap-2 px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-full text-base transition-colors shadow-sm"
        >
          Clean my photo
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>

        <p className="mt-4 text-sm text-gray-400">No signup. No watermark. Just your photo, cleaned.</p>

        {/* How it works */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl w-full text-left">
          {[
            {
              step: "1",
              title: "Upload your photo",
              desc: "Drag-drop or click to upload. Any product photo works.",
            },
            {
              step: "2",
              title: "AI cleans it",
              desc: "Background removed, cropped to Depop's 1:1 square spec. Takes ~15 seconds.",
            },
            {
              step: "3",
              title: "Download & list",
              desc: "Save your clean photo and go straight to your Depop listing.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                {step}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-6 text-center text-xs text-gray-400">
        Powered by{" "}
        <a
          href="https://runflow.io"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 transition-colors"
        >
          Runflow
        </a>{" "}
        · Built during Runflow Build Sprint 2026
      </footer>
    </div>
  );
}
