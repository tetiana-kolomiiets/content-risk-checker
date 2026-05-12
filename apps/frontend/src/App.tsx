import { useEffect, useRef, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { OnboardingModal } from './components/common/OnboardingModal';
import { Layout } from './components/layout/Layout';
import { useToast } from './components/ui/toast-context';
import { getRateLimitCountdownSteps, setApiErrorNotifier } from './lib/api';
import { ApiError } from './lib/types';
import { CheckPage } from './routes/CheckPage';
import { HomePage } from './routes/HomePage';
import { NotFoundPage } from './routes/NotFoundPage';

function App() {
  const { toast } = useToast();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(
    () => window.localStorage.getItem('crc_onboarded') !== '1',
  );
  const countdownTimeoutsRef = useRef<number[]>([]);
  const lastErrorToastAtRef = useRef(0);

  useEffect(() => {
    setApiErrorNotifier((error) => {
      if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
        countdownTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
        countdownTimeoutsRef.current = [];

        getRateLimitCountdownSteps().forEach((secondsLeft, index) => {
          const timeoutId = window.setTimeout(
            () => toast({ variant: 'info', duration: 1100, message: `Try again in ${secondsLeft}s.` }),
            index * 1000,
          );
          countdownTimeoutsRef.current.push(timeoutId);
        });
        return;
      }

      const now = Date.now();
      const shouldSkipDuplicateErrorToast = now - lastErrorToastAtRef.current < 4000;
      if (shouldSkipDuplicateErrorToast) {
        return;
      }

      lastErrorToastAtRef.current = now;
      if (error.message === 'Network error') {
        toast({ variant: 'error', message: 'Network error. Check your connection and try again.' });
        return;
      }

      toast({ variant: 'error', message: 'Something went wrong. Please try again.' });
    });

    return () => {
      setApiErrorNotifier(null);
      countdownTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      countdownTimeoutsRef.current = [];
    };
  }, [toast]);

  function handleOnboardingConfirm() {
    window.localStorage.setItem('crc_onboarded', '1');
    setIsOnboardingOpen(false);
  }

  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/checks/:id" element={<CheckPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
      <OnboardingModal isOpen={isOnboardingOpen} onConfirm={handleOnboardingConfirm} />
    </>
  );
}

export default App;
