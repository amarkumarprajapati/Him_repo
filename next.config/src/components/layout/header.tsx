import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { siteConfig } from '@/config/site';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-foreground/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          {siteConfig.name}
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/map-view"
            className="text-foreground/70 transition-colors hover:text-foreground"
          >
            Map View
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-foreground/15 px-3 py-1.5 text-foreground transition-colors hover:bg-foreground/5"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
