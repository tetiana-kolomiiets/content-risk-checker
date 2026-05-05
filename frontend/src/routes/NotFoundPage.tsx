import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="rounded-lg border border-border bg-surface p-8 text-center">
      <h1 className="mb-2 text-2xl font-medium">Not found</h1>
      <p className="mb-4 text-text-secondary">This page doesn't exist.</p>
      <Link to="/" className="text-accent hover:underline">
        Back to home
      </Link>
    </div>
  );
}
