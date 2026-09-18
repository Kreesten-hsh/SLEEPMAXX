import type {
  QuizAnswers,
  SleepmaxxResult,
  MorningLightFrequency,
  SleepmaxxCategory,
  SleepmaxxArchetype,
  CategoryResult,
} from '../../core/scoringEngine';

export type {
  QuizAnswers,
  SleepmaxxResult,
  MorningLightFrequency,
  SleepmaxxCategory,
  SleepmaxxArchetype,
  CategoryResult,
};

export type QuizStep = 'landing' | 'question' | 'result';

export interface QuizState {
  readonly step: QuizStep;
  readonly questionIndex: number; // 0 to 4 while step === 'question'
  readonly answers: Readonly<Partial<QuizAnswers>>;
  readonly result: Readonly<SleepmaxxResult> | null;
}

export type QuizAnswerPayload = {
  [K in keyof QuizAnswers]: { key: K; value: QuizAnswers[K] };
}[keyof QuizAnswers];

export type QuizAction =
  | { type: 'START_QUIZ' }
  | { type: 'ANSWER_QUESTION'; payload: QuizAnswerPayload }
  | { type: 'PREVIOUS_QUESTION' }
  | { type: 'RETAKE_QUIZ' }
  | { type: 'RESTORE_SESSION'; payload: QuizState };

export interface QuizOptionItem<T> {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly normalizedValue: T;
}

export interface QuizQuestion<K extends keyof QuizAnswers = keyof QuizAnswers> {
  readonly id: string;
  readonly answerKey: K;
  readonly stepNumber: number; // 1 to 5
  readonly title: string;
  readonly description?: string;
  readonly options: readonly QuizOptionItem<QuizAnswers[K]>[];
}

export interface PersistedQuizSession {
  readonly version: 1;
  readonly updatedAt: number; // epoch ms
  readonly step: QuizStep;
  readonly questionIndex: number;
  readonly answers: Partial<QuizAnswers>;
  readonly result: SleepmaxxResult | null;
}
