import React, { useEffect, useState } from 'react';
import { AppMode } from './types';
import { UploadLayout } from './components/layouts/UploadLayout';
import { useProjectStore } from './store/useProjectStore';
import { EditorProvider } from './context/EditorContext';
import { Workspace } from './components/Workspace';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.UPLOAD);
  
  const { 
    init: initStore, 
    currentProject, 
    isLoading: isStoreLoading 
  } = useProjectStore();
  
  useEffect(() => { initStore(); }, [initStore]);
  useEffect(() => { setMode(currentProject ? AppMode.EDITOR : AppMode.UPLOAD); }, [currentProject]);

  if (isStoreLoading) return <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-indigo-600"><p>Loading...</p></div>;

  return mode === AppMode.UPLOAD ? <UploadLayout /> : (
    <EditorProvider>
       <Workspace onHomeClick={() => setMode(AppMode.UPLOAD)} />
    </EditorProvider>
  );
};

export default App;