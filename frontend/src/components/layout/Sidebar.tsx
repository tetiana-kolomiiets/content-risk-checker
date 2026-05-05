import { FiPlus } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export function Sidebar() {
  return (
    <aside className="flex w-80 flex-col border-r border-border bg-surface">
      <div className="border-b border-border p-4">
        <Link
          to="/"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <FiPlus className="h-4 w-4" />
          New check
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-3 py-2 text-xs text-text-tertiary">No checks yet</p>
      </div>
    </aside>
  );
}
