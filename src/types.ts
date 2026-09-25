export type Topic =
  | 'llm'
  | 'ai_engineering'
  | 'deep_learning'
  | 'nlp'
  | 'classic_ml'
  | 'statistics'
  | 'math'
  | 'system_design'
  | 'mlops'
  | 'python'
  | 'sql'
  | 'algorithms'
  | 'experience'
  | 'behavioral';

export interface Question {
  id: string;
  question: string;
  topic: Topic;
  /** На скольких собеседованиях встречался вопрос. */
  asked: number;
  followUps: string[];
}

export type Filter<T extends string> = T | 'all';
