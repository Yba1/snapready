import Link from "next/link";
import ToolClient from "./ToolClient";

export const metadata = {
  title: "SnapReady — Clean your Depop photo",
};

export default function ToolPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-3xl mx-auto w-full">
        <Link href="/" className="font-semibold text-lg tracking-tight hover:text-gray-700 transition-colors">
          SnapReady
        </Link>
        <span className="text-sm text-gray-400">Free Depop photo cleaner</span>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Clean your photo</h1>
          <p className="text-sm text-gray-500">
            Background removed + cropped to 1:1 for Depop listings.
          </p>
        </div>
        <ToolClient />
      </main>

      <footer className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-400">
        Powered by Runflow AI
      </footer>
    </div>
  );
}
