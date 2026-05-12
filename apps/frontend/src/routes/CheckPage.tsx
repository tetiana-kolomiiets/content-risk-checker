import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckDetail } from '@/components/checks/CheckDetail';
import type { Check } from '@/lib/types';

export function CheckPage() {
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    return () => {
      document.title = 'Content risk checker';
    };
  }, []);

  function handleCheckLoaded(check: Check) {
    document.title = `check_${check.id}`;
  }

  if (!id) {
    return <div className="text-text-tertiary">Invalid URL</div>;
  }

  return <CheckDetail checkId={id} onCheckLoaded={handleCheckLoaded} />;
}
