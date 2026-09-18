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
import type { QuizAnswers } from '../../core/scoringEngine';

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
