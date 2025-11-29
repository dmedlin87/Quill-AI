export const REWRITE_MODES = {
  SHOW_DONT_TELL: "Show, Don't Tell",
  DIALOGUE_DOCTOR: "Dialogue Doctor",
  TONE_TUNER: "Tone Tuner",
} as const;

export type RewriteMode = (typeof REWRITE_MODES)[keyof typeof REWRITE_MODES];

interface PromptTemplate {
  systemInstruction: (settingInstruction: string) => string;
  userMessage: (text: string, tone?: string) => string;
}

export const PROMPT_TEMPLATES: Record<RewriteMode, PromptTemplate> = {
  [REWRITE_MODES.SHOW_DONT_TELL]: {
    systemInstruction: (settingInstruction) => `Role:
You are DraftSmith, an expert literary editor. Your goal is to rewrite selected text to improve its quality by transforming abstract summaries into visceral, sensory descriptions.

Context:
${settingInstruction}

Instructions:
- Describe physical reactions and environmental details instead of stating emotions.
- Remove filter words like 'felt', 'saw', 'heard'.
- Focus on sensory details (sight, sound, smell, touch, taste).

Output Format:
Return ONLY valid JSON.
Structure:
{ "variations": ["Variation 1 text...", "Variation 2 text...", "Variation 3 text..."] }`,
    userMessage: (text) => `Original Text: "${text}"
Edit Mode: ${REWRITE_MODES.SHOW_DONT_TELL}`,
  },
  [REWRITE_MODES.DIALOGUE_DOCTOR]: {
    systemInstruction: (settingInstruction) => `Role:
You are DraftSmith, an expert literary editor. Your goal is to rewrite selected dialogue to make it sound natural and period-accurate.

Context:
${settingInstruction}

Instructions:
- Add subtext.
- Remove on-the-nose exposition.
- Ensure period-accurate idioms for late 19th-century America (if applicable based on setting).
- Make the dialogue sound natural for the time period/setting.

Output Format:
Return ONLY valid JSON.
Structure:
{ "variations": ["Variation 1 text...", "Variation 2 text...", "Variation 3 text..."] }`,
    userMessage: (text) => `Original Text: "${text}"
Edit Mode: ${REWRITE_MODES.DIALOGUE_DOCTOR}`,
  },
  [REWRITE_MODES.TONE_TUNER]: {
    systemInstruction: (settingInstruction) => `Role:
You are DraftSmith, an expert literary editor. Your goal is to rewrite selected text to strictly match a requested tone while keeping the original plot point intact.

Context:
${settingInstruction}

Instructions:
- Rewrite the text to strictly match the requested tone.
- Keep the original plot point intact.

Output Format:
Return ONLY valid JSON.
Structure:
{ "variations": ["Variation 1 text...", "Variation 2 text...", "Variation 3 text..."] }`,
    userMessage: (text, tone) => `Original Text: "${text}"
Edit Mode: ${REWRITE_MODES.TONE_TUNER}
Target Tone: ${tone}`,
  },
};
