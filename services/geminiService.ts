import { GoogleGenAI, Type, Modality, LiveServerMessage, FunctionDeclaration } from "@google/genai";
import { AnalysisResult, PlotSuggestion } from "../types";
import { base64ToUint8Array, createBlob, decodeAudioData } from "./audioUtils";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// --- AGENT TOOLS ---

export const agentTools: FunctionDeclaration[] = [
  {
    name: 'update_manuscript',
    description: 'Replaces a specific section of text with new content. Use this to rewrite sentences, paragraphs, or fix typos. Provide the exact text to find and the replacement text.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        search_text: { type: Type.STRING, description: 'The exact text in the manuscript to be replaced.' },
        replacement_text: { type: Type.STRING, description: 'The new text to insert.' },
        description: { type: Type.STRING, description: 'A short summary of what changed (e.g. "Rewrote intro for clarity")' }
      },
      required: ['search_text', 'replacement_text', 'description']
    }
  },
  {
    name: 'append_to_manuscript',
    description: 'Adds new text to the very end of the manuscript.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text_to_add: { type: Type.STRING, description: 'The text to append.' },
        description: { type: Type.STRING, description: 'Short summary of addition.' }
      },
      required: ['text_to_add', 'description']
    }
  },
  {
    name: 'undo_last_change',
    description: 'Reverts the manuscript to the previous version.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    }
  }
];

// 1. Content Analysis (Deep Thinking)
export const analyzeDraft = async (text: string): Promise<AnalysisResult> => {
  const model = 'gemini-3-pro-preview'; 
  
  const prompt = `You are a world-class literary editor. Analyze the following book draft text.
  
  Your task is to provide a deep, comprehensive critique focusing specifically on:
  1. PACING & FLOW: Evaluate the rhythm of the narrative. Identify specific sections that drag (too slow) or rush (too fast). Analyze if the length of scenes supports the engagement. Give it a score from 1-10.
  2. PLOT HOLES & INCONSISTENCIES: Scrutinize the plot for logic gaps, dropped narrative threads, or contradictions. Provide concrete examples and how to fix them.
  3. CHARACTER ARCS & RELATIONSHIPS: Track the development of major characters. Create a brief bio for each. Identify key relationships for each character (allies, rivals, family, etc.) and describe the dynamic. Map out the specific plot threads each character is involved in. BREAK DOWN their specific arc into 3-5 key stages (e.g. Introduction, Conflict, Climax) showing their progression. Are their motivations clear? do they grow? Are there inconsistencies in behavior?
  
  Provide the output in strict JSON format matching the schema.
  
  Text excerpt:
  "${text.slice(0, 45000)}..."`;

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
          plotIssues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                issue: { type: Type.STRING },
                location: { type: Type.STRING, description: "Where in the text this happens" },
                suggestion: { type: Type.STRING, description: "How to resolve it" }
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
                bio: { type: Type.STRING, description: "Brief bio including traits and motivations." },
                arc: { type: Type.STRING, description: "Summary of their journey/growth" },
                arcStages: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            stage: { type: Type.STRING, description: "Name of the stage (e.g., 'The Call', 'The Fall')"},
                            description: { type: Type.STRING, description: "What happens to the character internally/externally here."}
                        },
                        required: ["stage", "description"]
                    },
                    description: "3-5 key stages of the character's progression."
                },
                relationships: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Name of the related character" },
                            type: { type: Type.STRING, description: "Type of relationship (e.g. Ally, Rival, Sibling)" },
                            dynamic: { type: Type.STRING, description: "Brief description of their interaction/dynamic" }
                        },
                        required: ["name", "type", "dynamic"]
                    }
                },
                plotThreads: {
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "Specific storylines or plot threads this character drives or is involved in."
                },
                inconsistencies: { type: Type.ARRAY, items: { type: Type.STRING } },
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
  return JSON.parse(jsonText) as AnalysisResult;
};

// 1.5 Generate Plot Ideas
export const generatePlotIdeas = async (text: string, userInstruction?: string, suggestionType: string = 'General'): Promise<PlotSuggestion[]> => {
  const model = 'gemini-3-pro-preview';
  
  const prompt = `You are an expert story consultant. 
  
  STEP 1: ANALYZE
  Read the provided draft excerpt. Distinctively identify:
  - The core conflict.
  - Current character motivations.
  - The tone and pacing.

  STEP 2: BRAINSTORM
  Generate 3-5 creative, high-quality plot suggestions based on the analysis.
  
  Target Type: ${suggestionType}
  User Constraint/Request: "${userInstruction || 'None - provide best options based on analysis'}"

  Ensure the ideas are:
  1. Specific (avoid vague advice like "make it more exciting").
  2. Integrated (fit the existing logic/world).
  3. Novel (avoid clichés).

  Text Context:
  "${text.slice(0, 45000)}..."`;

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
  return JSON.parse(jsonText) as PlotSuggestion[];
};

// 1.8 Rewrite Text (Magic Editor)
export const rewriteText = async (text: string, mode: string, tone?: string): Promise<string[]> => {
  const model = 'gemini-3-pro-preview';

  const systemInstruction = `Role:
You are DraftSmith, an expert literary editor and ghostwriter specializing in fiction. Your goal is to rewrite selected text to improve its quality based on a specific "Edit Mode." You must always provide 3 distinct, high-quality variations of the text.

Context:
The manuscript is a period drama set in late 19th-century rural America (farm life, horses, wagons). Ensure all rewritten dialogue and descriptions fit this setting.

Instructions per Mode:
If Mode is "Show, Don't Tell": Transform abstract summaries (e.g., "She was sad") into visceral, sensory descriptions (e.g., body language, physical sensations, environmental reflection). Do not use the abstract emotion word in the output.
If Mode is "Dialogue Doctor": Remove "on-the-nose" exposition. Make the dialogue sound natural for the time period. Add subtext—characters should rarely say exactly what they mean. Remove excessive pleasantries unless character-specific.
If Mode is "Tone Tuner": Rewrite the text to strictly match the requested tone (e.g., Darker, Humorous, Formal) while keeping the original plot point intact.

Output Format:
Return ONLY valid JSON. Do not include markdown formatting like \`\`\`json.
Structure:
{ "variations": ["Variation 1 text...", "Variation 2 text...", "Variation 3 text..."] }`;

  const userMessage = `Original Text: "${text}"
Edit Mode: ${mode}
${mode === 'Tone Tuner' ? `Target Tone: ${tone}` : ''}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userMessage,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                variations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ["variations"]
        }
      },
    });

    const jsonText = response.text || "{}";
    const result = JSON.parse(jsonText);
    return result.variations || [];
  } catch (e) {
    console.error("Rewrite failed", e);
    return [];
  }
};

// 1.9 Contextual Help (Explain/Thesaurus)
export const getContextualHelp = async (text: string, type: 'Explain' | 'Thesaurus'): Promise<string> => {
  const model = 'gemini-2.5-flash'; // Faster model for tools
  const systemInstruction = `You are a helpful writing assistant for a period drama set in late 19th-century rural America.
  If type is 'Explain': Provide a concise definition or historical context for the selected term/phrase.
  If type is 'Thesaurus': Provide 5 synonyms that fit the 19th-century period setting. Return ONLY a comma-separated list (e.g., "Word1, Word2, Word3").`;
  
  const prompt = `Type: ${type}\nText: "${text}"\nKeep the answer short and helpful.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { systemInstruction }
  });
  
  return response.text || "No result found.";
};

// 2. Chat Bot Agent
export const createAgentSession = () => {
  return ai.chats.create({
    model: 'gemini-2.5-flash', // Fast for tool calling loops
    config: {
      systemInstruction: `You are DraftSmith Agent, an advanced AI editor embedded in a text editor (like Cursor or Windsurf). 
      
      CAPABILITIES:
      1. You can READ the user's cursor position and selection.
      2. You can EDIT the manuscript directly using tools.
      
      BEHAVIOR:
      - If the user asks to change, rewrite, or fix something, USE THE 'update_manuscript' TOOL. Do not just output the text.
      - If the user asks to undo, USE THE 'undo_last_change' TOOL.
      - Always look at the cursor context provided in the user message.
      - Be concise in your text responses. Actions speak louder than words.
      - If you use a tool, briefly confirm what you did.
      `,
      tools: [{ functionDeclarations: agentTools }]
    }
  });
};

// 3. Text to Speech
export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    // Use a temporary context just for decoding the buffer
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const buffer = await decodeAudioData(
      base64ToUint8Array(base64Audio),
      audioContext,
      24000,
      1
    );
    // Close it immediately to free resources
    if (audioContext.state !== 'closed') {
      await audioContext.close();
    }
    return buffer;
  } catch (e) {
    console.error("TTS Error:", e);
    return null;
  }
};

// 4. Live API Connection
export const connectLiveSession = async (
  onAudioData: (buffer: AudioBuffer) => void,
  onClose: () => void
) => {
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  
  // We need a way to send data back to the caller
  let sendAudioInput: ((blob: any) => void) | undefined;
  
  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
      },
      systemInstruction: "You are an enthusiastic writing coach. You are talking to an author about their book draft. Be encouraging, ask probing questions about plot and character, and help them brainstorm verbally.",
    },
    callbacks: {
      onopen: () => {
        console.log("Live session opened");
      },
      onmessage: async (message: LiveServerMessage) => {
        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          // Check if context is valid before decoding/using
          if (outputAudioContext.state === 'closed') return;
          
          const audioBuffer = await decodeAudioData(
            base64ToUint8Array(base64Audio),
            outputAudioContext,
            24000,
            1
          );
          onAudioData(audioBuffer);
        }
      },
      onclose: () => {
        console.log("Live session closed");
        onClose();
      },
      onerror: (err) => {
        console.error("Live session error", err);
        onClose();
      }
    }
  });

  return {
    sendAudio: async (data: Float32Array) => {
      const pcmBlob = createBlob(data);
      const session = await sessionPromise;
      session.sendRealtimeInput({ media: pcmBlob });
    },
    disconnect: async () => {
      // Close the output context to prevent leaks
      if (outputAudioContext.state !== 'closed') {
        await outputAudioContext.close();
      }
      const session = await sessionPromise;
      (session as any).close?.(); 
    }
  };
};