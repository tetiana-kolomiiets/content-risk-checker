import { FiActivity } from 'react-icons/fi';

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md rounded-lg border border-border bg-surface p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-white">
            <FiActivity className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-medium">Content risk checker</h1>
        </div>
        <p className="text-text-secondary">
          Frontend scaffolded. API base:{' '}
          <code className="font-mono text-sm">
            {import.meta.env.VITE_API_BASE_URL}
          </code>
        </p>
      </div>
    </div>
  );
}

export default App;
