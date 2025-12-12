import * as AnalysisFeature from '@/features/analysis';

describe('features/analysis index', () => {
  it('exports analysis components and context', () => {
    expect(AnalysisFeature.AnalysisProvider).toBeDefined();
    expect(AnalysisFeature.useAnalysis).toBeDefined();
    expect(AnalysisFeature.BrainstormingPanel).toBeDefined();
    expect(AnalysisFeature.Dashboard).toBeDefined();
    expect(AnalysisFeature.ExecutiveSummary).toBeDefined();
    expect(AnalysisFeature.CharactersSection).toBeDefined();
    expect(AnalysisFeature.PacingSection).toBeDefined();
    expect(AnalysisFeature.PlotIssuesSection).toBeDefined();
    expect(AnalysisFeature.SettingConsistencySection).toBeDefined();
    expect(AnalysisFeature.StrengthsWeaknesses).toBeDefined();
    expect(AnalysisFeature.AnalysisPanel).toBeDefined();
    expect(AnalysisFeature.ShadowReaderPanel).toBeDefined();
    expect(AnalysisFeature.ScoreCard).toBeDefined();
    expect(AnalysisFeature.IssueCard).toBeDefined();
  });
});
