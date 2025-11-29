import React, { useEffect } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { ManuscriptProvider } from './contexts/ManuscriptContext';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { UsageProvider } from './contexts/UsageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainLayout } from './components/layout/MainLayout';

const App: React.FC = () => {
  const { init: initStore, isLoading: isStoreLoading } = useProjectStore();
  
  useEffect(() => { initStore(); }, [initStore]);

  if (isStoreLoading) return <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-indigo-600"><p>Loading...</p></div>;

  return (
    <ErrorBoundary>
      <UsageProvider>
        <ManuscriptProvider>
          <AnalysisProvider>
            <MainLayout />
          </AnalysisProvider>
        </ManuscriptProvider>
      </UsageProvider>
    </ErrorBoundary>
  );
};

export default App;
