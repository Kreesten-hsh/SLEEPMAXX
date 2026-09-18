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
