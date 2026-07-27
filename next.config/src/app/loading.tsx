export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-20">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground"
        aria-label="Loading"
      />
    </div>
  );
}
