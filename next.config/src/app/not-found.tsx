import Link from 'next/link';
import { cn } from '@/utils/cn';

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm font-medium text-foreground/60">404</p>
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-foreground/70">
        The page you’re looking for doesn’t exist or has been moved.
      </p>
      <Link
        href="/"
        className={cn(
          'mt-2 inline-flex h-10 items-center justify-center rounded-md bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90',
        )}
      >
        Back home
      </Link>
    </section>
  );
}
