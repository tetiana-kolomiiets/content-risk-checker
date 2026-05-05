import { useParams } from 'react-router-dom';
import { CheckDetail } from '@/components/checks/CheckDetail';

export function CheckPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div className="text-text-tertiary">Invalid URL</div>;
  }

  return <CheckDetail checkId={id} />;
}
