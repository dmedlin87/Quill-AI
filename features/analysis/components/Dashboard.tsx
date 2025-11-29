import React from 'react';
import { AnalysisResult } from '@/types';
import { AnalysisPanel } from './AnalysisPanel';
import { useEditor } from '@/features/shared';

interface DashboardProps {
    isLoading: boolean;
    analysis: AnalysisResult | null;
    currentText: string;
    onFixRequest?: (issueContext: string, suggestion: string) => void;
    warning?: string | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ isLoading, analysis, currentText, onFixRequest, warning }) => {
    const { handleNavigateToIssue } = useEditor();

    return (
        <AnalysisPanel 
            analysis={analysis} 
            isLoading={isLoading} 
            currentText={currentText}
            onNavigate={handleNavigateToIssue}
            onFixRequest={onFixRequest}
            warning={warning}
        />
    );
};
