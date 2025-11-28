import React from 'react';
import { ProjectDashboard } from '../ProjectDashboard';

export const UploadLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-full bg-[#f3f4f6] text-gray-900 font-sans">
      <ProjectDashboard />
    </div>
  );
};