import { siteConfig } from '@/config/site';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-foreground/10">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6 text-sm text-foreground/60">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
        <p>Built with Next.js + TanStack Query</p>
      </div>
    </footer>
  );
}
