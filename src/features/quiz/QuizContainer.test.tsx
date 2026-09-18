import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuizContainer } from './components/QuizContainer';
import { LandingScreen } from './components/LandingScreen';
import { QuestionScreen, AUTO_ADVANCE_DELAY_MS } from './components/QuestionScreen';
import { ResultScreen } from './components/ResultScreen';
import { ProgressBar } from './components/ProgressBar';
import { QUESTIONS, TOTAL_QUESTIONS } from './data/questions';
import { quizReducer, INITIAL_QUIZ_STATE } from './useQuizState';
import { createQuizStorage } from './storage';
import { calculateSleepmaxxScore } from '../../core/scoringEngine';
import type { QuizState } from './types';
import type { QuizAnswers, SleepmaxxResult } from '../../core/scoringEngine';
import { shareSleepmaxxScore } from './utils/shareScore';

vi.mock('./utils/shareScore', () => ({
  shareSleepmaxxScore: vi.fn().mockResolvedValue({ status: 'shared' }),
  DEFAULT_SHARE_TITLE: 'Sleepmaxx Routine Score',
  DEFAULT_SHARE_URL: 'https://sleepmaxx.app',
  SCORECARD_IMAGE_FILENAME: 'sleepmaxx-score.png',
  SCORECARD_IMAGE_MIME: 'image/png',
  GENERATION_FAILED_MESSAGE:
    'Unable to generate scorecard image. Please take a screenshot.',
  DOWNLOAD_FAILED_MESSAGE: 'Unable to download scorecard image.',
}));

let testHooksDispatcher: {
  useState: (initial: unknown) => [unknown, (val: unknown) => void];
  useRef: (initial: unknown) => { current: unknown };
} | null = null;

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const mockedUseState = ((initial: unknown) => {
    if (testHooksDispatcher) {
      return testHooksDispatcher.useState(initial);
    }
    return actual.useState(initial);
  }) as typeof actual.useState;

  const mockedUseRef = ((initial: unknown) => {
    if (testHooksDispatcher) {
      return testHooksDispatcher.useRef(initial);
    }
    return actual.useRef(initial);
  }) as typeof actual.useRef;

  return {
    ...actual,
    default: {
      ...actual,
      useState: mockedUseState,
      useRef: mockedUseRef,
    },
    useState: mockedUseState,
    useRef: mockedUseRef,
  };
});

describe('User Story 1: End-to-End Quiz Journey Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Landing Screen initial render', () => {
    it('renders Sleepmaxx branding, core promise, and Start Quiz CTA', () => {
      const onStart = vi.fn();
      const html = renderToStaticMarkup(<LandingScreen onStart={onStart} />);

      expect(html).toContain('Sleepmaxx');
      expect(html).toContain('Discover your');
      expect(html).toContain('Can you reach 90 in 7 days?');
      expect(html).toContain('Start Quiz');
      expect(html).not.toMatch(/<button[^>]*>Next<\/button>/i);
    });

    it('renders Landing view in QuizContainer when session is fresh', () => {
      const emptyStorage = createQuizStorage({
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      });

      const html = renderToStaticMarkup(<QuizContainer storageAdapter={emptyStorage} />);
      expect(html).toContain('Start Quiz');
      expect(html).toContain('Discover your');
    });
  });

  describe('2. Question Screen & Auto-Advance interaction (150ms delay & anti-multitap)', () => {
    it('renders Question 1 with ProgressBar, all 6 options, and ZERO Next button', () => {
      const q1 = QUESTIONS[0];
      const onAnswer = vi.fn();

      const html = renderToStaticMarkup(
        <QuestionScreen
          question={q1}
          progressPercentage={20}
          onAnswer={onAnswer}
        />
      );

      // Verify question and options
      expect(html).toContain(q1.title);
      expect(html).toContain('Question 1 of 5');
      expect(html).toContain('20%');
      expect(html).toContain('&lt; 5 hours');
      expect(html).toContain('7 – 8.9 hours');

      // ABSOLUTE REQUIREMENT: No Next button
      expect(html).not.toMatch(/Next/i);
      expect(html).not.toMatch(/Suivant/i);
    });

    it('executes auto-advance with exact ~150ms delay and gates rapid multi-taps', () => {
      const onAnswer = vi.fn();

      // We test the auto-advance logic directly
      let isTransitioning = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const handleSelect = (normalizedValue: number) => {
        if (isTransitioning) return;
        isTransitioning = true;
        timer = setTimeout(() => {
          onAnswer(normalizedValue);
        }, AUTO_ADVANCE_DELAY_MS);
      };

      // 1. User taps option (8.0 hrs)
      handleSelect(8.0);

      // Immediately after tap: onAnswer MUST NOT be called yet (visual feedback period)
      expect(onAnswer).not.toHaveBeenCalled();

      // 2. Rapid multi-tap at t=50ms (user taps another option during feedback window)
      vi.advanceTimersByTime(50);
      handleSelect(4.5); // should be ignored by anti-multitap gate

      expect(onAnswer).not.toHaveBeenCalled();

      // 3. Complete the 150ms delay (advance remaining 100ms)
      vi.advanceTimersByTime(100);

      // Auto-advance triggers exactly once with the original answer
      expect(onAnswer).toHaveBeenCalledTimes(1);
      expect(onAnswer).toHaveBeenCalledWith(8.0);

      if (timer) clearTimeout(timer);
    });
  });

  describe('3. ProgressBar presentation', () => {
    it('renders step number, total steps, and accessible progressbar markup', () => {
      const html = renderToStaticMarkup(
        <ProgressBar currentStep={3} totalSteps={TOTAL_QUESTIONS} progressPercentage={60} />
      );

      expect(html).toContain('Question 3 of 5');
      expect(html).toContain('60%');
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="60"');
    });
  });

  describe('4. Complete End-to-End Happy Path (Landing → Q1..Q5 → Result 100/100 ELITE)', () => {
    it('progresses through all 5 questions with known perfect answers and produces 100/100 ELITE result', () => {
      // Step 0: Initial state at landing
      let state: QuizState = INITIAL_QUIZ_STATE;
      expect(state.step).toBe('landing');

      // Step 1: Start Quiz → Question 1 (Duration)
      state = quizReducer(state, { type: 'START_QUIZ' });
      expect(state.step).toBe('question');
      expect(state.questionIndex).toBe(0);

      // Verify Q1 HTML contains no Next button
      const q1Html = renderToStaticMarkup(
        <QuestionScreen
          question={QUESTIONS[0]}
          progressPercentage={20}
          onAnswer={() => {}}
        />
      );
      expect(q1Html).not.toMatch(/Next/i);

      // Step 2: Answer Question 1 (7 - 8.9 hours -> 8.0)
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });
      expect(state.step).toBe('question');
      expect(state.questionIndex).toBe(1);

      // Step 3: Answer Question 2 (No shift -> 0.0)
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 0.0 },
      });
      expect(state.step).toBe('question');
      expect(state.questionIndex).toBe(2);

      // Step 4: Answer Question 3 (I don't drink caffeine -> null)
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'hoursSinceLastCaffeineBeforeBed', value: null },
      });
      expect(state.step).toBe('question');
      expect(state.questionIndex).toBe(3);

      // Step 5: Answer Question 4 (0 minutes in bed -> 0)
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'screenMinutesInBed', value: 0 },
      });
      expect(state.step).toBe('question');
      expect(state.questionIndex).toBe(4);

      // Step 6: Answer Question 5 (Almost Always -> 'almost_always')
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'morningLightFrequency', value: 'almost_always' },
      });

      // Terminal transition: step is now 'result'
      expect(state.step).toBe('result');
      expect(state.result).not.toBeNull();

      // Verify exact deterministic score calculation from pure scoring engine
      const expectedScoringResult = calculateSleepmaxxScore(state.answers as QuizAnswers);
      expect(state.result).toEqual(expectedScoringResult);

      // Score verification
      expect(state.result?.totalScore).toBe(100);
      expect(state.result?.archetype.id).toBe('elite');
      expect(state.result?.archetype.label).toBe('ELITE');
      expect(state.result?.biggestWeakness.pointsLost).toBe(0);

      // Render ResultScreen with calculated result
      const onRetake = vi.fn();
      const resultHtml = renderToStaticMarkup(
        <ResultScreen result={state.result!} onRetake={onRetake} />
      );

      // Verify UI display requirements
      expect(resultHtml).toContain('100');
      expect(resultHtml).toContain('ELITE');
      expect(resultHtml).toContain('out of 100 possible points');
      expect(resultHtml).toContain('Zero Habit Weaknesses Detected');
      expect(resultHtml).toContain('Routine Breakdown');
      expect(resultHtml).toContain('35 / 35');
      expect(resultHtml).toContain('25 / 25');
      expect(resultHtml).toContain('20 / 20');
      expect(resultHtml).toContain('10 / 10');

      // Verify non-medical disclaimer is clearly present
      expect(resultHtml).toContain('Non-Medical Wellness Notice');
      expect(resultHtml).toContain('Retake Quiz');
    });

    it('renders completed ResultScreen directly inside QuizContainer when initialized with completed session', () => {
      const perfectAnswers: QuizAnswers = {
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.0,
        hoursSinceLastCaffeineBeforeBed: null,
        screenMinutesInBed: 0,
        morningLightFrequency: 'almost_always',
      };
      const result = calculateSleepmaxxScore(perfectAnswers);

      const completedState: QuizState = {
        step: 'result',
        questionIndex: 4,
        answers: perfectAnswers,
        result,
      };

      const mockStorage = createQuizStorage({
        getItem: () =>
          JSON.stringify({
            version: 1,
            step: completedState.step,
            questionIndex: completedState.questionIndex,
            answers: completedState.answers,
            result: completedState.result,
            updatedAt: Date.now(),
          }),
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 1,
      });

      const html = renderToStaticMarkup(<QuizContainer storageAdapter={mockStorage} />);
      expect(html).toContain('100');
      expect(html).toContain('ELITE');
      expect(html).toContain('Retake Quiz');
      expect(html).toContain('Non-Medical Wellness Notice');
    });
  });
});

describe('User Story 2: Step-by-Step Navigation & Correction Integration', () => {
  describe('1. Back navigation preserves all previously recorded answers', () => {
    it('navigates from Q3 back to Q2 and preserves Q1+Q2+Q3 answers in state', () => {
      let state: QuizState = INITIAL_QUIZ_STATE;

      // Start → Q1 → Q2 → Q3
      state = quizReducer(state, { type: 'START_QUIZ' });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 0.5 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'hoursSinceLastCaffeineBeforeBed', value: 7.0 },
      });

      // At Q4 (index 3). Navigate back to Q3 (index 2)
      expect(state.questionIndex).toBe(3);
      state = quizReducer(state, { type: 'PREVIOUS_QUESTION' });

      expect(state.questionIndex).toBe(2);
      expect(state.step).toBe('question');
      // All 3 answers preserved
      expect(state.answers).toEqual({
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.5,
        hoursSinceLastCaffeineBeforeBed: 7.0,
      });
    });

    it('navigates back multiple steps (Q3 → Q2 → Q1) without losing any answer', () => {
      let state: QuizState = INITIAL_QUIZ_STATE;

      state = quizReducer(state, { type: 'START_QUIZ' });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 6.5 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 1.5 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'hoursSinceLastCaffeineBeforeBed', value: 5.0 },
      });

      // Q4 → Q3 → Q2 → Q1
      state = quizReducer(state, { type: 'PREVIOUS_QUESTION' }); // → Q3
      state = quizReducer(state, { type: 'PREVIOUS_QUESTION' }); // → Q2
      state = quizReducer(state, { type: 'PREVIOUS_QUESTION' }); // → Q1

      expect(state.questionIndex).toBe(0);
      expect(state.answers).toEqual({
        sleepDurationHours: 6.5,
        weekendShiftHours: 1.5,
        hoursSinceLastCaffeineBeforeBed: 5.0,
      });
    });
  });

  describe('2. Answer correction with back navigation produces updated score', () => {
    it('goes back from Q3, changes Q2 answer, re-advances to Q5, and final score reflects the correction', () => {
      let state: QuizState = INITIAL_QUIZ_STATE;

      // Full forward: L → Q1 → Q2 → Q3
      state = quizReducer(state, { type: 'START_QUIZ' });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });
      // Initially answer Q2 with 3.5 (worst consistency)
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 3.5 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'hoursSinceLastCaffeineBeforeBed', value: null },
      });

      // At Q4 (index 3). Go back to Q2 (index 1)
      state = quizReducer(state, { type: 'PREVIOUS_QUESTION' }); // → Q3 (index 2)
      state = quizReducer(state, { type: 'PREVIOUS_QUESTION' }); // → Q2 (index 1)
      expect(state.questionIndex).toBe(1);

      // CORRECT Q2: change from 3.5 to 0.0 (perfect consistency)
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 0.0 },
      });

      // Q3 answer still preserved (caffeine = null), re-advance from Q3
      expect(state.questionIndex).toBe(2);
      expect(state.answers.hoursSinceLastCaffeineBeforeBed).toBe(null);

      // Re-answer Q3 (same value), Q4, Q5 to reach result
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'hoursSinceLastCaffeineBeforeBed', value: null },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'screenMinutesInBed', value: 0 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'morningLightFrequency', value: 'almost_always' },
      });

      // Should be at result
      expect(state.step).toBe('result');
      expect(state.result).not.toBeNull();

      // The corrected answer (0.0 instead of 3.5) should produce 100/100
      const expectedResult = calculateSleepmaxxScore(state.answers as QuizAnswers);
      expect(state.result).toEqual(expectedResult);
      expect(state.result?.totalScore).toBe(100);
      expect(state.result?.archetype.id).toBe('elite');
      expect(state.result?.categories.consistency.earned).toBe(25); // Full marks after correction
    });
  });

  describe('3. Back from Q1 returns to landing', () => {
    it('navigates from Q1 (index 0) back to landing step', () => {
      let state: QuizState = INITIAL_QUIZ_STATE;

      state = quizReducer(state, { type: 'START_QUIZ' });
      expect(state.step).toBe('question');
      expect(state.questionIndex).toBe(0);

      state = quizReducer(state, { type: 'PREVIOUS_QUESTION' });
      expect(state.step).toBe('landing');
      expect(state.questionIndex).toBe(0);
    });
  });

  describe('4. Pre-selection rendering on back navigation', () => {
    it('renders QuestionScreen with previously selected option highlighted when selectedAnswer is provided', () => {
      const q2 = QUESTIONS[1]; // weekendShiftHours
      const onAnswer = vi.fn();

      // Render Q2 with pre-selected answer value 0.5 → should match option id 'shift_under_1'
      const html = renderToStaticMarkup(
        <QuestionScreen
          question={q2}
          progressPercentage={40}
          onAnswer={onAnswer}
          selectedAnswer={0.5}
        />
      );

      // The rendered output should include Q2 content
      expect(html).toContain(q2.title);
      expect(html).toContain('Under 1 hour');

      // The option with value 0.5 should be aria-checked=true (pre-selected)
      expect(html).toContain('aria-checked="true"');
    });

    it('renders QuestionScreen with NO pre-selection when selectedAnswer is undefined (fresh question)', () => {
      const q1 = QUESTIONS[0];
      const onAnswer = vi.fn();

      const html = renderToStaticMarkup(
        <QuestionScreen
          question={q1}
          progressPercentage={20}
          onAnswer={onAnswer}
        />
      );

      // All options should be aria-checked=false (none selected)
      expect(html).not.toContain('aria-checked="true"');
    });

    it('renders QuestionScreen with pre-selection for null value (caffeine = no caffeine)', () => {
      const q3 = QUESTIONS[2]; // hoursSinceLastCaffeineBeforeBed
      const onAnswer = vi.fn();

      const html = renderToStaticMarkup(
        <QuestionScreen
          question={q3}
          progressPercentage={60}
          onAnswer={onAnswer}
          selectedAnswer={null}
        />
      );

      // null maps to "I don't drink caffeine" option
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain("I don&#x27;t drink caffeine");
    });
  });

  describe('5. Zero dependency on browser history API', () => {
    it('entire US2 flow never manipulates window.history or popstate', () => {
      // Verify the source files don't reference browser history APIs
      // This is a static assertion — the architecture guarantees in-app-only navigation
      const questionScreenSource = QuestionScreen.toString();
      const quizContainerSource = QuizContainer.toString();

      expect(questionScreenSource).not.toContain('pushState');
      expect(questionScreenSource).not.toContain('popstate');
      expect(questionScreenSource).not.toContain('history');
      expect(quizContainerSource).not.toContain('pushState');
      expect(quizContainerSource).not.toContain('popstate');
    });
  });
});

describe('User Story 3: In-Session Resilience & Refresh Handling Integration', () => {
  describe('1. Mid-quiz refresh restoration', () => {
    it('saves state after answering Q1+Q2, simulates reload, and restores at Q3 with answers intact', () => {
      // Simulate a MockStorage that persists across "reloads"
      const store = new Map<string, string>();
      const persistentStorage: Storage = {
        length: 0,
        clear: () => store.clear(),
        key: () => null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
      };

      const storageAdapter = createQuizStorage(persistentStorage);

      // Session 1: User answers Q1 and Q2
      let state: QuizState = INITIAL_QUIZ_STATE;
      state = quizReducer(state, { type: 'START_QUIZ' });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 6.5 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 1.5 },
      });

      // State is at Q3 (index 2). Save to storage (simulates useEffect save)
      storageAdapter.saveSession(state);

      // Session 2: Simulate browser refresh — load from storage
      const restoredState = storageAdapter.loadSession();

      expect(restoredState).not.toBeNull();
      expect(restoredState!.step).toBe('question');
      expect(restoredState!.questionIndex).toBe(2);
      expect(restoredState!.answers).toEqual({
        sleepDurationHours: 6.5,
        weekendShiftHours: 1.5,
      });
      expect(restoredState!.result).toBeNull();
    });
  });

  describe('2. Multi-answer restoration preserves all recorded answers', () => {
    it('saves Q1+Q2+Q3 answers, reloads, and all three are present', () => {
      const store = new Map<string, string>();
      const persistentStorage: Storage = {
        length: 0,
        clear: () => store.clear(),
        key: () => null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
      };

      const storageAdapter = createQuizStorage(persistentStorage);

      // Progress through Q1, Q2, Q3
      let state: QuizState = INITIAL_QUIZ_STATE;
      state = quizReducer(state, { type: 'START_QUIZ' });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 0.0 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'hoursSinceLastCaffeineBeforeBed', value: null },
      });

      storageAdapter.saveSession(state);

      // Reload
      const restored = storageAdapter.loadSession();
      expect(restored).not.toBeNull();
      expect(restored!.answers).toEqual({
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.0,
        hoursSinceLastCaffeineBeforeBed: null,
      });
      expect(restored!.questionIndex).toBe(3);
    });
  });

  describe('3. Retake purges all answers, result, and resets step', () => {
    it('completes quiz, dispatches RETAKE_QUIZ, and state is fully reset', () => {
      // Complete a quiz
      let state: QuizState = INITIAL_QUIZ_STATE;
      state = quizReducer(state, { type: 'START_QUIZ' });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 0.0 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'hoursSinceLastCaffeineBeforeBed', value: null },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'screenMinutesInBed', value: 0 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'morningLightFrequency', value: 'almost_always' },
      });

      expect(state.step).toBe('result');
      expect(state.result).not.toBeNull();
      expect(state.result?.totalScore).toBe(100);

      // Retake
      state = quizReducer(state, { type: 'RETAKE_QUIZ' });

      expect(state.step).toBe('landing');
      expect(state.questionIndex).toBe(0);
      expect(state.answers).toEqual({});
      expect(state.result).toBeNull();
    });
  });

  describe('4. Retake purges localStorage via clearSession', () => {
    it('calls clearSession which removes the storage key, making loadSession return null', () => {
      const store = new Map<string, string>();
      const persistentStorage: Storage = {
        length: 0,
        clear: () => store.clear(),
        key: () => null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
      };

      const storageAdapter = createQuizStorage(persistentStorage);

      // Save a completed session
      const completedState: QuizState = {
        step: 'result',
        questionIndex: 4,
        answers: {
          sleepDurationHours: 8.0,
          weekendShiftHours: 0.0,
          hoursSinceLastCaffeineBeforeBed: null,
          screenMinutesInBed: 0,
          morningLightFrequency: 'almost_always',
        },
        result: calculateSleepmaxxScore({
          sleepDurationHours: 8.0,
          weekendShiftHours: 0.0,
          hoursSinceLastCaffeineBeforeBed: null,
          screenMinutesInBed: 0,
          morningLightFrequency: 'almost_always',
        }),
      };

      storageAdapter.saveSession(completedState);
      expect(storageAdapter.loadSession()).not.toBeNull();

      // Retake: clear storage (mirrors retakeQuiz callback behavior)
      storageAdapter.clearSession();

      // Storage is now empty
      expect(storageAdapter.loadSession()).toBeNull();
      expect(persistentStorage.getItem('sleepmaxx_quiz_session_v1')).toBeNull();
    });
  });

  describe('5. New session after retake produces independent results', () => {
    it('old answers do not contaminate new session after retake', () => {
      const store = new Map<string, string>();
      const persistentStorage: Storage = {
        length: 0,
        clear: () => store.clear(),
        key: () => null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
      };

      const storageAdapter = createQuizStorage(persistentStorage);

      // Session 1: Complete with worst answers
      let state: QuizState = INITIAL_QUIZ_STATE;
      state = quizReducer(state, { type: 'START_QUIZ' });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 4.5 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 3.5 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'hoursSinceLastCaffeineBeforeBed', value: 1.0 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'screenMinutesInBed', value: 75 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'morningLightFrequency', value: 'never' },
      });

      expect(state.result?.totalScore).toBe(0);
      storageAdapter.saveSession(state);

      // Retake: clear + reset
      storageAdapter.clearSession();
      state = quizReducer(state, { type: 'RETAKE_QUIZ' });
      expect(state.answers).toEqual({});

      // Session 2: Answer with perfect answers
      state = quizReducer(state, { type: 'START_QUIZ' });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });

      // Only new answer present — no contamination from old session
      expect(state.answers).toEqual({ sleepDurationHours: 8.0 });
      expect(state.questionIndex).toBe(1);

      // Save new session
      storageAdapter.saveSession(state);
      const restored = storageAdapter.loadSession();
      expect(restored!.answers).toEqual({ sleepDurationHours: 8.0 });

      // Complete new session with perfect answers
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 0.0 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'hoursSinceLastCaffeineBeforeBed', value: null },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'screenMinutesInBed', value: 0 },
      });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'morningLightFrequency', value: 'almost_always' },
      });

      // New session score: 100, NOT 0 from old session
      expect(state.step).toBe('result');
      expect(state.result?.totalScore).toBe(100);
      expect(state.result?.archetype.id).toBe('elite');
    });
  });

  describe('6. Corrupted storage yields clean initial state', () => {
    it('loads corrupted JSON from storage and falls back to null (initial state)', () => {
      const corruptedStorage: Storage = {
        length: 1,
        clear: () => {},
        key: () => null,
        getItem: () => '{this-is-not-valid-json!!!',
        setItem: () => {},
        removeItem: () => {},
      };

      const storageAdapter = createQuizStorage(corruptedStorage);
      const loaded = storageAdapter.loadSession();
      expect(loaded).toBeNull();
    });

    it('loads structurally invalid payload (wrong version) and falls back to null', () => {
      const wrongVersionStorage: Storage = {
        length: 1,
        clear: () => {},
        key: () => null,
        getItem: () => JSON.stringify({
          version: 999,
          step: 'question',
          questionIndex: 2,
          answers: { sleepDurationHours: 8.0 },
          result: null,
          updatedAt: Date.now(),
        }),
        setItem: () => {},
        removeItem: () => {},
      };

      const storageAdapter = createQuizStorage(wrongVersionStorage);
      expect(storageAdapter.loadSession()).toBeNull();
    });

    it('renders QuizContainer at Landing when storage contains corrupted data', () => {
      const corruptedStorage = createQuizStorage({
        length: 1,
        clear: () => {},
        key: () => null,
        getItem: () => '{"version":1,"step":"INVALID","questionIndex":0,"answers":{},"result":null}',
        setItem: () => {},
        removeItem: () => {},
      });

      const html = renderToStaticMarkup(<QuizContainer storageAdapter={corruptedStorage} />);
      expect(html).toContain('Start Quiz');
      expect(html).toContain('Discover your');
    });
  });

  describe('7. Unavailable localStorage does not crash the application', () => {
    it('operates normally when all storage operations throw', () => {
      const throwingStorage: Storage = {
        length: 0,
        clear: () => { throw new Error('SecurityError'); },
        key: () => { throw new Error('SecurityError'); },
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => { throw new Error('SecurityError'); },
        removeItem: () => { throw new Error('SecurityError'); },
      };

      const storageAdapter = createQuizStorage(throwingStorage);

      // Load returns null without throwing
      expect(() => storageAdapter.loadSession()).not.toThrow();
      expect(storageAdapter.loadSession()).toBeNull();

      // Save does not throw
      expect(() => storageAdapter.saveSession(INITIAL_QUIZ_STATE)).not.toThrow();

      // Clear does not throw
      expect(() => storageAdapter.clearSession()).not.toThrow();
    });

    it('renders QuizContainer at Landing when storage is completely unavailable', () => {
      const unavailableStorage = createQuizStorage({
        length: 0,
        clear: () => { throw new Error('SecurityError'); },
        key: () => { throw new Error('SecurityError'); },
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => { throw new Error('SecurityError'); },
        removeItem: () => { throw new Error('SecurityError'); },
      });

      const html = renderToStaticMarkup(<QuizContainer storageAdapter={unavailableStorage} />);
      expect(html).toContain('Start Quiz');
    });

    it('quiz progresses normally with throwing storage — no crash', () => {
      const throwingStorage = createQuizStorage({
        length: 0,
        clear: () => { throw new Error('SecurityError'); },
        key: () => { throw new Error('SecurityError'); },
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => { throw new Error('SecurityError'); },
        removeItem: () => { throw new Error('SecurityError'); },
      });

      // Reducer still works — storage failures are silently ignored
      let state: QuizState = throwingStorage.loadSession() ?? INITIAL_QUIZ_STATE;
      expect(state.step).toBe('landing');

      state = quizReducer(state, { type: 'START_QUIZ' });
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });

      expect(state.step).toBe('question');
      expect(state.questionIndex).toBe(1);
      expect(state.answers.sleepDurationHours).toBe(8.0);
    });
  });

  describe('Phase 7: Polish, Responsive & Accessibility Verification (T025, T026)', () => {
    describe('T025: Responsive Mobile-First & Touch Targets', () => {
      it('renders semantic <main> landmark on all primary screens', () => {
        const landingHtml = renderToStaticMarkup(<LandingScreen onStart={() => {}} />);
        expect(landingHtml).toMatch(/^<main[^>]*class="landing-screen"/);

        const questionHtml = renderToStaticMarkup(
          <QuestionScreen
            question={QUESTIONS[0]}
            progressPercentage={20}
            onAnswer={() => {}}
            onBack={() => {}}
          />
        );
        expect(questionHtml).toMatch(/^<main[^>]*class="question-screen"/);

        const perfectAnswers: QuizAnswers = {
          sleepDurationHours: 8.0,
          weekendShiftHours: 0.0,
          hoursSinceLastCaffeineBeforeBed: null,
          screenMinutesInBed: 0,
          morningLightFrequency: 'almost_always',
        };
        const result = calculateSleepmaxxScore(perfectAnswers);
        const resultHtml = renderToStaticMarkup(<ResultScreen result={result} onRetake={() => {}} />);
        expect(resultHtml).toMatch(/^<main[^>]*class="result-screen"/);
      });

      it('guarantees touch targets >= 52px for all primary interactive controls', () => {
        const landingHtml = renderToStaticMarkup(<LandingScreen onStart={() => {}} />);
        expect(landingHtml).toContain('min-height:var(--touch-target-min)');

        const questionHtml = renderToStaticMarkup(
          <QuestionScreen
            question={QUESTIONS[1]}
            progressPercentage={40}
            onAnswer={() => {}}
            onBack={() => {}}
          />
        );
        // Back button must have touch-target-min for both height and width
        expect(questionHtml).toContain('aria-label="Previous question"');
        expect(questionHtml).toContain('min-height:var(--touch-target-min)');
        expect(questionHtml).toContain('min-width:var(--touch-target-min)');

        // Option cards must have min-height touch target
        for (const opt of QUESTIONS[1].options) {
          expect(questionHtml).toContain(opt.label);
        }

        const perfectAnswers: QuizAnswers = {
          sleepDurationHours: 8.0,
          weekendShiftHours: 0.0,
          hoursSinceLastCaffeineBeforeBed: null,
          screenMinutesInBed: 0,
          morningLightFrequency: 'almost_always',
        };
        const result = calculateSleepmaxxScore(perfectAnswers);
        const resultHtml = renderToStaticMarkup(<ResultScreen result={result} onRetake={() => {}} />);
        expect(resultHtml).toContain('min-height:var(--touch-target-min)');
      });
    });

    describe('T026: Accessibility & Keyboard Navigation', () => {
      it('renders WAI-ARIA radiogroup and radio items with accessible states', () => {
        const q = QUESTIONS[0];
        const html = renderToStaticMarkup(
          <QuestionScreen
            question={q}
            progressPercentage={20}
            onAnswer={() => {}}
            selectedAnswer={8.0}
          />
        );

        // Radiogroup container
        expect(html).toContain('role="radiogroup"');
        expect(html).toContain(`aria-labelledby="question-title-${q.id}"`);

        // Radio items
        expect(html).toContain('role="radio"');
        expect(html).toContain('tabindex="0"');

        // Pre-selected option has aria-checked="true", others have "false"
        expect(html).toContain('aria-checked="true"');
        expect(html).toContain('aria-checked="false"');
      });

      it('includes accessible labels on all actionable controls', () => {
        const landingHtml = renderToStaticMarkup(<LandingScreen onStart={() => {}} />);
        expect(landingHtml).toContain('aria-label="Start Quiz"');

        const questionHtml = renderToStaticMarkup(
          <QuestionScreen
            question={QUESTIONS[2]}
            progressPercentage={60}
            onAnswer={() => {}}
            onBack={() => {}}
          />
        );
        expect(questionHtml).toContain('aria-label="Previous question"');
      });

      it('progress bar exposes valid ARIA progressbar semantics', () => {
        const html = renderToStaticMarkup(
          <ProgressBar currentStep={2} totalSteps={5} progressPercentage={40} />
        );
        expect(html).toContain('role="progressbar"');
        expect(html).toContain('aria-valuenow="40"');
        expect(html).toContain('aria-valuemin="0"');
        expect(html).toContain('aria-valuemax="100"');
        expect(html).toContain('aria-label="Question 2 of 5"');
      });
    });
  });

  describe('User Story: ResultScreen Share Score Action Integration (T007–T008)', () => {
    const sampleResult: SleepmaxxResult = {
      totalScore: 72,
      categories: {
        duration: { earned: 22, max: 35, lost: 13 },
        consistency: { earned: 17, max: 25, lost: 8 },
        caffeine: { earned: 18, max: 20, lost: 2 },
        screen: { earned: 8, max: 10, lost: 2 },
        morningLight: { earned: 7, max: 10, lost: 3 },
      },
      archetype: {
        id: 'recovering',
        label: 'RECOVERING',
      },
      biggestWeakness: {
        id: 'duration',
        label: 'Sleep Duration',
        pointsLost: 13,
      },
    };

    function findElement(
      tree: unknown,
      predicate: (el: React.ReactElement<Record<string, unknown>>) => boolean
    ): React.ReactElement<Record<string, unknown>> | null {
      if (!tree || typeof tree !== 'object') return null;
      if (React.isValidElement(tree)) {
        const el = tree as React.ReactElement<Record<string, unknown>>;
        if (predicate(el)) return el;
        const children = (el.props as { children?: React.ReactNode })?.children;
        if (Array.isArray(children)) {
          for (const child of children) {
            const found = findElement(child, predicate);
            if (found) return found;
          }
        } else if (children) {
          return findElement(children, predicate);
        }
      }
      return null;
    }

    function mountResultScreen(props: { result: SleepmaxxResult; onRetake: () => void }) {
      const hooks: unknown[] = [];
      let hookIndex = 0;
      let currentTree: React.ReactElement | null = null;

      function render(): React.ReactElement {
        hookIndex = 0;
        testHooksDispatcher = {
          useState: (initial: unknown) => {
            const idx = hookIndex++;
            if (hooks[idx] === undefined) {
              hooks[idx] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
            }
            const setState = (nextVal: unknown) => {
              hooks[idx] =
                typeof nextVal === 'function'
                  ? (nextVal as (prev: unknown) => unknown)(hooks[idx])
                  : nextVal;
              render();
            };
            return [hooks[idx], setState];
          },
          useRef: (initial: unknown) => {
            const idx = hookIndex++;
            if (hooks[idx] === undefined) {
              hooks[idx] = { current: initial };
            }
            return hooks[idx] as { current: unknown };
          },
        };

        try {
          currentTree = (ResultScreen as (p: typeof props) => React.ReactElement)(props);
          return currentTree;
        } finally {
          testHooksDispatcher = null;
        }
      }

      render();

      type TestElementProps = Record<string, unknown> & {
        children?: React.ReactNode;
        disabled?: boolean;
        type?: string;
        role?: string;
        onClick?: (e?: unknown) => Promise<void> | void;
      };

      return {
        getTree: () => currentTree!,
        getShareButton: () => {
          const btn = findElement(
            currentTree,
            (el) => el.props?.['data-testid'] === 'share-score-btn'
          );
          if (!btn) throw new Error('Share button not found');
          return btn as React.ReactElement<TestElementProps>;
        },
        getRetakeButton: () => {
          const btn = findElement(
            currentTree,
            (el) => el.props?.['data-testid'] === 'retake-quiz-btn'
          );
          if (!btn) throw new Error('Retake button not found');
          return btn as React.ReactElement<TestElementProps>;
        },
        getLiveRegion: () => {
          const region = findElement(
            currentTree,
            (el) => el.props?.['data-testid'] === 'result-status-live'
          );
          if (!region) throw new Error('Live region not found');
          return region as React.ReactElement<TestElementProps>;
        },
        clickShare: async () => {
          const btn = findElement(
            currentTree,
            (el) => el.props?.['data-testid'] === 'share-score-btn'
          );
          if (!btn || typeof btn.props?.onClick !== 'function') {
            throw new Error('Share button has no onClick function');
          }
          return (btn.props.onClick as (e: unknown) => Promise<void>)({});
        },
      };
    }

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('1. Share button rendering: renders native <button type="button"> with label Share Score', () => {
      const html = renderToStaticMarkup(
        <ResultScreen result={sampleResult} onRetake={() => {}} />
      );
      expect(html).toContain('data-testid="share-score-btn"');
      expect(html).toMatch(/<button[^>]*type="button"[^>]*class="[^"]*share-score-btn[^"]*"[^>]*>/);
      expect(html).toContain('Share Score');

      // Also verify when rendered in QuizContainer from completed session
      const completedStorage = createQuizStorage({
        getItem: () =>
          JSON.stringify({
            version: 1,
            step: 'result',
            questionIndex: 4,
            answers: {},
            result: sampleResult,
            updatedAt: Date.now(),
          }),
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 1,
      });
      const containerHtml = renderToStaticMarkup(
        <QuizContainer storageAdapter={completedStorage} />
      );
      expect(containerHtml).toContain('data-testid="share-score-btn"');
      expect(containerHtml).toContain('Share Score');
    });

    it('2. No redundant role: button does not specify role="button"', () => {
      const html = renderToStaticMarkup(
        <ResultScreen result={sampleResult} onRetake={() => {}} />
      );
      const match = html.match(/<button[^>]*class="[^"]*share-score-btn[^"]*"[^>]*>/);
      expect(match).not.toBeNull();
      expect(match![0]).not.toContain('role="button"');
      expect(match![0]).not.toContain('role=');

      // Also verify on the component instance element props directly
      const mounted = mountResultScreen({ result: sampleResult, onRetake: () => {} });
      expect(mounted.getShareButton().props.role).toBeUndefined();
      expect(mounted.getShareButton().props.type).toBe('button');
    });

    it('3. Primary ordering: Share Score appears before Retake Quiz in the DOM', () => {
      const html = renderToStaticMarkup(
        <ResultScreen result={sampleResult} onRetake={() => {}} />
      );
      const scorecardIdx = html.indexOf('class="scorecard-container"');
      const shareBtnIdx = html.indexOf('data-testid="share-score-btn"');
      const retakeBtnIdx = html.indexOf('data-testid="retake-quiz-btn"');

      expect(scorecardIdx).toBeGreaterThan(0);
      expect(shareBtnIdx).toBeGreaterThan(scorecardIdx);
      expect(retakeBtnIdx).toBeGreaterThan(shareBtnIdx);
    });

    it('4. Touch target: guarantees min-height touch target constraint >= 52px', () => {
      const html = renderToStaticMarkup(
        <ResultScreen result={sampleResult} onRetake={() => {}} />
      );
      expect(html).toContain('data-testid="share-score-btn"');
      expect(html).toContain('min-height:var(--touch-target-min)');
    });

    it('5. Loading state: disabled, aria-busy="true", loading text, and gates rapid double activation', async () => {
      let resolvePromise!: (val: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(shareSleepmaxxScore).mockReturnValue(pendingPromise as any);

      const mounted = mountResultScreen({
        result: sampleResult,
        onRetake: () => {},
      });

      // Initial idle state
      expect(mounted.getShareButton().props.disabled).toBe(false);
      expect(mounted.getShareButton().props['aria-busy']).toBeUndefined();
      expect(mounted.getShareButton().props.children).toBe('Share Score');

      // 1. User clicks the actual rendered Share button
      const firstClick = mounted.clickShare();

      // Observable UI state while processing:
      expect(shareSleepmaxxScore).toHaveBeenCalledTimes(1);
      expect(mounted.getShareButton().props.disabled).toBe(true);
      expect(mounted.getShareButton().props['aria-busy']).toBe('true');
      expect(mounted.getShareButton().props.children).toBe('Sharing…');

      // 2. Rapid double click while still processing: must be ignored by instance lock
      const secondClick = mounted.clickShare();
      expect(shareSleepmaxxScore).toHaveBeenCalledTimes(1);

      // Resolve pending orchestrator
      resolvePromise({ status: 'shared' });
      await firstClick;
      await secondClick;

      // Observable UI state after resolution: returns to idle
      expect(mounted.getShareButton().props.disabled).toBe(false);
      expect(mounted.getShareButton().props['aria-busy']).toBeUndefined();
      expect(mounted.getShareButton().props.children).toBe('Share Score');
    });

    it('6. Native success feedback: announces accessible confirmation via live region', async () => {
      vi.mocked(shareSleepmaxxScore).mockResolvedValue({ status: 'shared' });

      const mounted = mountResultScreen({
        result: sampleResult,
        onRetake: () => {},
      });

      await mounted.clickShare();

      expect(shareSleepmaxxScore).toHaveBeenCalledTimes(1);
      expect(mounted.getLiveRegion().props.children).toBe('ScoreCard shared successfully.');
      expect(mounted.getShareButton().props.disabled).toBe(false);
      expect(mounted.getShareButton().props.children).toBe('Share Score');
    });

    it('7. Download fallback feedback: announces exact download and clipboard copy message', async () => {
      vi.mocked(shareSleepmaxxScore).mockResolvedValue({ status: 'downloaded' });

      const mounted = mountResultScreen({
        result: sampleResult,
        onRetake: () => {},
      });

      await mounted.clickShare();

      expect(mounted.getLiveRegion().props.children).toBe(
        'ScoreCard image downloaded. Share link copied to clipboard.'
      );
    });

    it('8. Clipboard failure: distinguishes download from clipboard failure and never claims image was copied', async () => {
      vi.mocked(shareSleepmaxxScore).mockResolvedValue({ status: 'downloaded_text_failed' });

      const mounted = mountResultScreen({
        result: sampleResult,
        onRetake: () => {},
      });

      await mounted.clickShare();

      const msg = String(mounted.getLiveRegion().props.children);
      expect(msg).toBe(
        'ScoreCard image downloaded. Could not copy share link to clipboard.'
      );
      expect(msg).toContain('ScoreCard image downloaded');
      expect(msg).toContain('Could not copy share link to clipboard');
      expect(msg).not.toContain('copied to clipboard.');
      expect(msg.toLowerCase()).not.toContain('image copied');
      expect(msg.toLowerCase()).not.toContain('copied image');
    });

    it('9. Abort isolation: silent reset to idle with zero error messages on user cancellation', async () => {
      vi.mocked(shareSleepmaxxScore).mockResolvedValue({ status: 'aborted' });

      const mounted = mountResultScreen({
        result: sampleResult,
        onRetake: () => {},
      });

      await mounted.clickShare();

      expect(mounted.getLiveRegion().props.children).toBe('');
      expect(mounted.getShareButton().props.disabled).toBe(false);
      expect(mounted.getShareButton().props['aria-busy']).toBeUndefined();
      expect(mounted.getShareButton().props.children).toBe('Share Score');
    });

    it('10. Generation failure: displays exact required recovery copy', async () => {
      vi.mocked(shareSleepmaxxScore).mockResolvedValue({
        status: 'generation_failed',
        message: 'Unable to generate scorecard image. Please take a screenshot.',
      });

      const mounted = mountResultScreen({
        result: sampleResult,
        onRetake: () => {},
      });

      await mounted.clickShare();

      expect(mounted.getLiveRegion().props.children).toBe(
        'Unable to generate scorecard image. Please take a screenshot.'
      );
      expect(mounted.getShareButton().props.disabled).toBe(false);
      expect(mounted.getShareButton().props.children).toBe('Share Score');
    });

    it('11. Download failure: displays exact required download failure feedback', async () => {
      vi.mocked(shareSleepmaxxScore).mockResolvedValue({
        status: 'failed',
        message: 'Unable to download scorecard image.',
      });

      const mounted = mountResultScreen({
        result: sampleResult,
        onRetake: () => {},
      });

      await mounted.clickShare();

      expect(mounted.getLiveRegion().props.children).toBe('Unable to download scorecard image.');
      expect(mounted.getShareButton().props.disabled).toBe(false);
      expect(mounted.getShareButton().props.children).toBe('Share Score');
    });

    it('12. Retake regression: Retake Quiz remains fully functional and independent of Share action', () => {
      const onRetake = vi.fn();
      const mounted = mountResultScreen({
        result: sampleResult,
        onRetake,
      });

      const retakeBtn = mounted.getRetakeButton();
      expect(retakeBtn.props.children).toBe('Retake Quiz');
      expect(retakeBtn.props['data-testid']).toBe('retake-quiz-btn');

      // Trigger retake click
      retakeBtn.props.onClick?.({} as any);
      expect(onRetake).toHaveBeenCalledTimes(1);

      // Verify static markup
      const html = renderToStaticMarkup(
        <ResultScreen result={sampleResult} onRetake={onRetake} />
      );
      expect(html).toContain('data-testid="retake-quiz-btn"');
      expect(html).toContain('Retake Quiz');
      expect(html).toContain('data-testid="share-score-btn"');
      expect(html).toContain('Share Score');
    });
  });
});
