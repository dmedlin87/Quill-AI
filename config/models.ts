/**
 * Centralized Model Configuration
 * 
 * All Gemini model IDs are defined here to enable easy version upgrades
 * and ensure consistency across the application.
 */
 
type ModelRole = 'analysis' | 'agent' | 'tts' | 'liveAudio' | 'tools';

type Provider = 'gemini' | 'openai';

interface ModelDefinition {
  id: string;
  provider: Provider;
  role: ModelRole;
  maxTokens?: number;
  costTier?: 'cheap' | 'balanced' | 'premium';
  latencyTier?: 'fast' | 'medium' | 'slow';
  defaultThinkingBudget?: number;
  inputPrice?: number;
  outputPrice?: number;
}

type ModelBuildKey = 'default' | 'cheap' | 'deepThinking';

type ModelBuild = Record<ModelRole, ModelDefinition>;

type Pricing = { inputPrice: number; outputPrice: number };

const getEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  if (import.meta.env) {
    return import.meta.env[key];
  }
  return undefined;
};

const MODEL_BUILD_ENV = (getEnv('VITE_MODEL_BUILD') || getEnv('MODEL_BUILD')) as
  | ModelBuildKey
  | undefined;

export const ModelBuilds: Record<ModelBuildKey, ModelBuild> = {
  default: {
    analysis: {
      id: 'gemini-3-pro-preview',
      provider: 'gemini',
      role: 'analysis',
      maxTokens: 1_000_000,
      costTier: 'balanced',
      latencyTier: 'medium',
      defaultThinkingBudget: 32768,
      inputPrice: 1.25,
      outputPrice: 5.0,
    },
    agent: {
      id: 'gemini-2.5-flash',
      provider: 'gemini',
      role: 'agent',
      costTier: 'cheap',
      latencyTier: 'fast',
      inputPrice: 0.075,
      outputPrice: 0.3,
    },
    tts: {
      id: 'gemini-2.5-flash-preview-tts',
      provider: 'gemini',
      role: 'tts',
      maxTokens: 8_000,
      costTier: 'balanced',
      latencyTier: 'medium',
    },
    liveAudio: {
      id: 'gemini-2.5-flash-native-audio-preview-09-2025',
      provider: 'gemini',
      role: 'liveAudio',
      maxTokens: 32_000,
      costTier: 'balanced',
      latencyTier: 'medium',
    },
    tools: {
      id: 'gemini-2.5-flash',
      provider: 'gemini',
      role: 'tools',
      costTier: 'cheap',
      latencyTier: 'fast',
      inputPrice: 0.075,
      outputPrice: 0.3,
    },
  },
  cheap: {
    analysis: {
      id: 'gemini-2.5-flash',
      provider: 'gemini',
      role: 'analysis',
      maxTokens: 1_000_000,
      costTier: 'cheap',
      latencyTier: 'fast',
      defaultThinkingBudget: 16384,
      inputPrice: 0.075,
      outputPrice: 0.3,
    },
    agent: {
      id: 'gemini-2.5-flash',
      provider: 'gemini',
      role: 'agent',
      costTier: 'cheap',
      latencyTier: 'fast',
    },
    tts: {
      id: 'gemini-2.5-flash-preview-tts',
      provider: 'gemini',
      role: 'tts',
      maxTokens: 8_000,
      costTier: 'cheap',
      latencyTier: 'fast',
    },
    liveAudio: {
      id: 'gemini-2.5-flash-native-audio-preview-09-2025',
      provider: 'gemini',
      role: 'liveAudio',
      maxTokens: 32_000,
      costTier: 'cheap',
      latencyTier: 'fast',
    },
    tools: {
      id: 'gemini-2.5-flash',
      provider: 'gemini',
      role: 'tools',
      costTier: 'cheap',
      latencyTier: 'fast',
      inputPrice: 0.075,
      outputPrice: 0.3,
    },
  },
  deepThinking: {
    analysis: {
      id: 'gemini-3-pro-preview',
      provider: 'gemini',
      role: 'analysis',
      maxTokens: 1_000_000,
      costTier: 'premium',
      latencyTier: 'slow',
      defaultThinkingBudget: 65536,
      inputPrice: 1.25,
      outputPrice: 5.0,
    },
    agent: {
      id: 'gemini-3-pro-preview',
      provider: 'gemini',
      role: 'agent',
      maxTokens: 1_000_000,
      costTier: 'premium',
      latencyTier: 'medium',
      inputPrice: 1.25,
      outputPrice: 5.0,
    },
    tts: {
      id: 'gemini-2.5-flash-preview-tts',
      provider: 'gemini',
      role: 'tts',
      maxTokens: 8_000,
      costTier: 'balanced',
      latencyTier: 'medium',
    },
    liveAudio: {
      id: 'gemini-2.5-flash-native-audio-preview-09-2025',
      provider: 'gemini',
      role: 'liveAudio',
      maxTokens: 32_000,
      costTier: 'balanced',
      latencyTier: 'medium',
    },
    tools: {
      id: 'gemini-3-pro-preview',
      provider: 'gemini',
      role: 'tools',
      maxTokens: 1_000_000,
      costTier: 'premium',
      latencyTier: 'medium',
      inputPrice: 1.25,
      outputPrice: 5.0,
    },
  },
};

const FALLBACK_PRICING: Record<string, Pricing> = {
  // Legacy or external model IDs not represented in ModelBuilds
  'gemini-1.5-pro': { inputPrice: 1.25, outputPrice: 5.0 },
};

const buildModelPricing = (
  builds: Record<ModelBuildKey, ModelBuild>,
  fallback: Record<string, Pricing>
): Readonly<Record<string, Pricing>> => {
  const pricing: Record<string, Pricing> = { ...fallback };

  for (const build of Object.values(builds)) {
    for (const def of Object.values(build)) {
      if (
        typeof def.inputPrice === 'number' &&
        typeof def.outputPrice === 'number'
      ) {
        pricing[def.id] = {
          inputPrice: def.inputPrice,
          outputPrice: def.outputPrice,
        };
      }
    }
  }

  return Object.freeze(pricing);
};

export const ModelPricing = buildModelPricing(ModelBuilds, FALLBACK_PRICING);

export const getModelPricing = (
  modelId: string
): { inputPrice: number; outputPrice: number } | null => {
  return ModelPricing[modelId] ?? null;
};

const ACTIVE_BUILD_KEY: ModelBuildKey =
  MODEL_BUILD_ENV && MODEL_BUILD_ENV in ModelBuilds ? MODEL_BUILD_ENV : 'default';

export const ActiveModels: ModelBuild = ModelBuilds[ACTIVE_BUILD_KEY];

export const ModelConfig = {
  get analysis() {
    return ActiveModels.analysis.id;
  },
  get agent() {
    return ActiveModels.agent.id;
  },
  get tts() {
    return ActiveModels.tts.id;
  },
  get liveAudio() {
    return ActiveModels.liveAudio.id;
  },
  get tools() {
    return ActiveModels.tools.id;
  },
  get pro() {
    return this.analysis;
  },
  get flash() {
    return this.agent;
  },
} as const;

/**
 * Token limits per model (approximate)
 * Used by tokenGuard to prevent context window overflow
 */
export const TokenLimits = {
  'gemini-3-pro-preview': 1_000_000,
  'gemini-2.5-flash': 1_000_000,
  'gemini-2.5-flash-preview-tts': 8_000,
  'gemini-2.5-flash-native-audio-preview-09-2025': 32_000,
} as const;

/**
 * Default thinking budgets for deep analysis
 */
export const ThinkingBudgets = {
  analysis: 32768,
  plotIdeas: 8192,
  rewrite: 4096,
} as const;

export type ModelId = keyof typeof TokenLimits;
