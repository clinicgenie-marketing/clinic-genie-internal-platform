import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="card p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted mt-2">The record may not exist or you may not have access to it.</p>
        <Link href="/" className="text-action underline mt-4 inline-block">Back to the dashboard</Link>
      </div>
    </main>
  );
}
