import { useParams } from 'react-router-dom';

export function CheckPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="rounded-lg border border-border bg-surface p-8">
      <p className="text-text-secondary">
        Check detail for <code className="font-mono">{id}</code> coming in F5.
      </p>
    </div>
  );
}
