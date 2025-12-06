import { ProjectDashboard } from '@/features/project';

export function UploadLayout() {
  return (
    <div className="flex h-screen w-full bg-[#f3f4f6] text-gray-900 font-sans">
      <ProjectDashboard />
    </div>
  );
}