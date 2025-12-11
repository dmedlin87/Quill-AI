import React, { useEffect } from 'react';
import { useProjectStore } from '@/features/project';
import { EditorProvider, EngineProvider, UsageProvider, ErrorBoundary } from '@/features/shared';
import { AppBrainProvider } from '@/features/core';
import { AnalysisProvider } from '@/features/analysis';
import { MainLayout } from '@/features/layout';
import { LoadingScreen } from '@/features/shared/components/LoadingScreen';
import { QuotaExhaustedModal } from '@/features/settings/components/QuotaExhaustedModal';

const App: React.FC = () => {
  const { init: initStore, isLoading: isStoreLoading, flushPendingWrites } = useProjectStore();
  
  useEffect(() => { initStore(); }, [initStore]);

  useEffect(() => {
    const flushAndReport = async (reason: 'visibilitychange' | 'beforeunload') => {
      try {
        const { pendingCount, errors } = (await flushPendingWrites({ reason, keepAlive: true })) ?? {
          pendingCount: 0,
          errors: [],
        };

        if (pendingCount > 0) {
          const summary = `[App] ${errors.length > 0 ? 'Failed to flush' : 'Flushed'} ${pendingCount} pending writes during ${reason}`;

          if (errors.length > 0) {
            console.error(summary, errors);
          } else {
            console.info(summary);
          }
        }
      } catch (error) {
        console.error(`[App] Unexpected error while flushing pending writes during ${reason}`, error);
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        await flushAndReport('visibilitychange');
      }
    };

    const handleBeforeUnload = async () => {
      await flushAndReport('beforeunload');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushPendingWrites]);

  if (isStoreLoading) return <LoadingScreen message="Loading your library..." subMessage="Connecting to your manuscripts" />;

  return (
    <ErrorBoundary>
      <UsageProvider>
        <EditorProvider>
          <EngineProvider>
            <AnalysisProvider>
              <AppBrainProvider>
                <MainLayout />
              </AppBrainProvider>
            </AnalysisProvider>
          </EngineProvider>
        </EditorProvider>
      </UsageProvider>
    </ErrorBoundary>
  );
};

export default App;
