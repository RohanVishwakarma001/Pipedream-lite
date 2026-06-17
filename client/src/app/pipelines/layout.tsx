import Link from 'next/link';
import { Plus, Zap, LayoutGrid, GitBranch } from 'lucide-react';

export default function PipelinesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top nav */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-gray-800 flex-shrink-0">
        <Link href="/pipelines" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center group-hover:bg-brand-400 transition-colors">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white">Pipedream-lite</span>
          <span className="text-xs text-gray-600 font-mono ml-1">v1.0</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/pipelines"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Pipelines
          </Link>
          <Link
            href="/pipelines/new"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-500 hover:bg-brand-400 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            New Pipeline
          </Link>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
