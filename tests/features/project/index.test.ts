import * as ProjectFeature from '@/features/project';

describe('features/project index', () => {
  it('exports project store and components', () => {
    expect(ProjectFeature.useProjectStore).toBeDefined();
    expect(ProjectFeature.ProjectDashboard).toBeDefined();
    expect(ProjectFeature.ProjectSidebar).toBeDefined();
    expect(ProjectFeature.ImportWizard).toBeDefined();
    expect(ProjectFeature.FileUpload).toBeDefined();
    expect(ProjectFeature.StoryBoard).toBeDefined();
  });
});
