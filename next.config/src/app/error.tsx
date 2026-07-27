'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-foreground/70">
        {'An unexpected error occurred. Please try again.'}
      </p>
      {error.digest ? (
        <p className="text-xs text-foreground/40">Ref: {error.digest}</p>
      ) : null}
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
