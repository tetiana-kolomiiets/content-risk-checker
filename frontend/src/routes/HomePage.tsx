import { useEffect, useState } from 'react';
import { NewCheckForm } from '@/components/checks/NewCheckForm';
import { api } from '@/lib/api';

export function HomePage() {
  const [hasExistingChecks, setHasExistingChecks] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .listChecks()
      .then((response) => {
        if (!cancelled) {
          setHasExistingChecks(response.items.length > 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasExistingChecks(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <NewCheckForm hasExistingChecks={hasExistingChecks} />;
}
