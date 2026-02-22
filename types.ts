export interface GroundingSource {
  title: string;
  uri: string;
}

export interface User {
  email: string;
  isVerified: boolean;
  avatar?: string;
}

export interface Discovery {
  title: string;
  organization: string;
  type: string;
  status: string;
  deadline: string;
  amount: string;
  description: string;
  applyLink: string;
  difficulty?: string; // "1" to "5" — application complexity
  tags?: string[];     // keyword tags e.g. ["AI", "Non-dilutive", "Global"]
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  discoveries?: Discovery[];
  sources?: GroundingSource[];
  isTyping?: boolean;
  isResearching?: boolean;
}

export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'custom';

export interface AISettings {
  provider: AIProvider;
  geminiKey: string;
  openaiKey: string;
  openrouterKey: string;
  customBaseUrl: string;
  customKey: string;
  customModel: string;
  model: string; // The specific model identifier (e.g. "gemini-1.5-flash", "gpt-4o")
}

export const DEFAULT_SETTINGS: AISettings = {
  provider: 'openrouter',
  geminiKey: '',
  openaiKey: '',
  openrouterKey: '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',
  customBaseUrl: '',
  customKey: '',
  customModel: '',
  model: 'arcee-ai/trinity-large-preview:free'
};