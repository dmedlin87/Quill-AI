import { Type, UsageMetadata } from "@google/genai";
import { AnalysisResult, PlotSuggestion } from "../../types";
import { ManuscriptIndex } from "../../types/schema";
import { ai } from "./client";
import { ANALYSIS_PROMPT, PLOT_IDEAS_PROMPT } from "./prompts";

export const analyzeDraft = async (
    text: string, 
    setting?: { timePeriod: string, location: string }, 
    manuscriptIndex?: ManuscriptIndex,
    _signal?: AbortSignal
): Promise<{ result: AnalysisResult; usage?: UsageMetadata }> => {
  const model = 'gemini-3-pro-preview'; 
  
  const settingContext = setting 
    ? `SETTING CONTEXT: Time Period: ${setting.timePeriod}, Location: ${setting.location}.` 
    : `SETTING CONTEXT: General Fiction (Unknown setting).`;

  const indexContext = manuscriptIndex 
  ? `KNOWN CHARACTER FACTS (from previous chapters):
     ${Object.entries(manuscriptIndex.characters).map(([name, data]) => 
         `${name}: ${Object.entries(data.attributes || {})
           .map(([attr, vals]) => `${attr}=${vals[0]?.value}`)
           .join(', ')}`
       ).join('\n')}`
  : '';

  const prompt = ANALYSIS_PROMPT
    .replace('{{SETTING_CONTEXT}}', settingContext)
    .replace('{{INDEX_CONTEXT}}', indexContext)
    .replace('{{SETTING_LABEL}}', setting ? 'specified time period' : 'apparent setting')
    .replace('{{TEXT}}', text.slice(0, 45000));

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          pacing: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER, description: "1-10" },
              analysis: { type: Type.STRING, description: "Overall analysis of flow and structure" },
              slowSections: { type: Type.ARRAY, items: { type: Type.STRING } },
              fastSections: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["score", "analysis", "slowSections", "fastSections"]
          },
          settingAnalysis: {
            type: Type.OBJECT,
            properties: {
                score: { type: Type.NUMBER, description: "1-10" },
                analysis: { type: Type.STRING },
                issues: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            quote: { type: Type.STRING },
                            issue: { type: Type.STRING, description: "Description of the anachronism or tone error"},
                            suggestion: { type: Type.STRING },
                            alternatives: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["quote", "issue", "suggestion"]
                    }
                }
            },
            required: ["score", "analysis", "issues"]
          },
          plotIssues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                issue: { type: Type.STRING },
                location: { type: Type.STRING, description: "Where in the text this happens" },
                suggestion: { type: Type.STRING, description: "How to resolve it" },
                quote: { type: Type.STRING, description: "Exact quote from text evidencing this issue (max 20 words)" }
              },
              required: ["issue", "location", "suggestion"]
            }
          },
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                bio: { type: Type.STRING },
                arc: { type: Type.STRING },
                arcStages: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            stage: { type: Type.STRING},
                            description: { type: Type.STRING}
                        },
                        required: ["stage", "description"]
                    }
                },
                relationships: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            type: { type: Type.STRING },
                            dynamic: { type: Type.STRING }
                        },
                        required: ["name", "type", "dynamic"]
                    }
                },
                plotThreads: {
                    type: Type.ARRAY, 
                    items: { type: Type.STRING }
                },
                inconsistencies: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT,
                        properties: {
                            issue: { type: Type.STRING },
                            quote: { type: Type.STRING, description: "Exact quote from text evidencing this inconsistency" }
                        },
                        required: ["issue"]
                    } 
                },
                developmentSuggestion: { type: Type.STRING }
              },
              required: ["name", "bio", "arc", "arcStages", "relationships", "plotThreads", "inconsistencies", "developmentSuggestion"]
            }
          },
          generalSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["summary", "strengths", "weaknesses", "pacing", "plotIssues", "characters", "generalSuggestions"],
      },
    },
  });

  const jsonText = response.text || "{}";
  return {
    result: JSON.parse(jsonText) as AnalysisResult,
    usage: response.usageMetadata
  };
};

export const generatePlotIdeas = async (text: string, userInstruction?: string, suggestionType: string = 'General'): Promise<{ result: PlotSuggestion[]; usage?: UsageMetadata }> => {
  const model = 'gemini-3-pro-preview';
  
  const prompt = PLOT_IDEAS_PROMPT
    .replace('{{SUGGESTION_TYPE}}', suggestionType)
    .replace('{{USER_INSTRUCTION}}', userInstruction || 'None - provide best options based on analysis')
    .replace('{{TEXT}}', text.slice(0, 45000));

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 8192 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                reasoning: { type: Type.STRING, description: "How this links to existing plot/characters" }
            },
            required: ["title", "description", "reasoning"]
        }
      }
    }
  });

  const jsonText = response.text || "[]";
  return {
    result: JSON.parse(jsonText) as PlotSuggestion[],
    usage: response.usageMetadata
  };
};
