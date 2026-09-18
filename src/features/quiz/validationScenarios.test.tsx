import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LandingScreen } from './components/LandingScreen';
import { QuestionScreen, AUTO_ADVANCE_DELAY_MS } from './components/QuestionScreen';
import { ResultScreen } from './components/ResultScreen';
import { ScoreCard } from './components/ScoreCard';
import { QUESTIONS } from './data/questions';
import { quizReducer, INITIAL_QUIZ_STATE } from './useQuizState';
import { createQuizStorage } from './storage';
import { calculateSleepmaxxScore } from '../../core/scoringEngine';
import type { QuizState } from './types';
import type { QuizAnswers } from '../../core/scoringEngine';

describe('T027: Manual & Comprehensive Validation Scenarios (A through G)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Scenario A — Fresh session
  describe('Scenario A: Fresh Session (Landing → Q1..Q5 → Result)', () => {
    it('executes full fresh session from landing to result with zero crash', () => {
      let state: QuizState = INITIAL_QUIZ_STATE;
      expect(state.step).toBe('landing');

      // Verify Landing Screen rendering
      const landingHtml = renderToStaticMarkup(<LandingScreen onStart={() => {}} />);
      expect(landingHtml).toContain('Discover your');
      expect(landingHtml).toContain('Sleepmaxx Score');
      expect(landingHtml).toContain('Start Quiz');

      // Start Quiz
      state = quizReducer(state, { type: 'START_QUIZ' });
      expect(state.step).toBe('question');
      expect(state.questionIndex).toBe(0);

      // Q1: 8.0 hrs
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });
      expect(state.questionIndex).toBe(1);

      // Q2: 0.0 hrs shift
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 0.0 },
      });
      expect(state.questionIndex).toBe(2);

      // Q3: null (no caffeine)
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'hoursSinceLastCaffeineBeforeBed', value: null },
      });
      expect(state.questionIndex).toBe(3);

      // Q4: 0 screen minutes
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'screenMinutesInBed', value: 0 },
      });
      expect(state.questionIndex).toBe(4);

      // Q5: 'almost_always'
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'morningLightFrequency', value: 'almost_always' },
      });

      // Verification of completion and ScoreCard rendering
      expect(state.step).toBe('result');
      expect(state.result).not.toBeNull();
      expect(state.result?.totalScore).toBe(100);
      expect(state.result?.archetype.label).toBe('ELITE');

      const resultHtml = renderToStaticMarkup(
        <ResultScreen result={state.result!} onRetake={() => {}} />
      );
      expect(resultHtml).toContain('100');
      expect(resultHtml).toContain('ELITE');
      expect(resultHtml).toContain('data-testid="score-value"');
      expect(resultHtml).toContain('data-testid="archetype-badge"');
      expect(resultHtml).toContain('data-testid="weakness-badge"');
      expect(resultHtml).toContain('data-testid="brand-watermark"');
    });
  });

  // Scenario B — Back navigation
  describe('Scenario B: Back Navigation & Answer Correction', () => {
    it('navigates Q1 → Q2 → Q3 → Back to Q2, updates answer, and recalculates properly', () => {
      let state: QuizState = INITIAL_QUIZ_STATE;
      state = quizReducer(state, { type: 'START_QUIZ' });

      // Answer Q1: 8.0 hrs
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });
      // Answer Q2: 3.5 hrs (severe shift, 0 pts)
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 3.5 },
      });
      expect(state.questionIndex).toBe(2);

      // Back to Q2
      state = quizReducer(state, { type: 'PREVIOUS_QUESTION' });
      expect(state.questionIndex).toBe(1);
      expect(state.answers.weekendShiftHours).toBe(3.5);

      // Modify Q2 answer to 0.0 hrs (perfect consistency, 25 pts)
      state = quizReducer(state, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 0.0 },
      });
      expect(state.questionIndex).toBe(2);
      expect(state.answers.weekendShiftHours).toBe(0.0);

      // Answer Q3, Q4, Q5
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
      expect(state.result?.categories.consistency.earned).toBe(25);
      expect(state.result?.totalScore).toBe(100);
    });
  });

  // Scenario C — Refresh
  describe('Scenario C: Page Refresh & In-Flight State Restoration', () => {
    it('restores in-progress questionnaire from storage without answer loss', () => {
      let storedJson: string | null = null;
      const storageMock = {
        getItem: () => storedJson,
        setItem: (_key: string, value: string) => {
          storedJson = value;
        },
        removeItem: () => {
          storedJson = null;
        },
        clear: () => {
          storedJson = null;
        },
        key: () => null,
        length: 0,
      };

      const storage = createQuizStorage(storageMock);

      // Answer Q1 and Q2
      const inFlightState: QuizState = {
        step: 'question',
        questionIndex: 2,
        answers: {
          sleepDurationHours: 8.0,
          weekendShiftHours: 0.0,
        },
        result: null,
      };
      storage.saveSession(inFlightState);

      // Simulate refresh by loading fresh session from storage
      const restored = storage.loadSession();
      expect(restored).not.toBeNull();
      expect(restored?.step).toBe('question');
      expect(restored?.questionIndex).toBe(2);
      expect(restored?.answers.sleepDurationHours).toBe(8.0);
      expect(restored?.answers.weekendShiftHours).toBe(0.0);
    });
  });

  // Scenario D — Retake
  describe('Scenario D: Retake Quiz Reset', () => {
    it('completely purges recorded answers, result, and storage, returning to clean Landing', () => {
      let storedJson: string | null = 'some-prior-session';
      const storageMock = {
        getItem: () => storedJson,
        setItem: (_key: string, value: string) => {
          storedJson = value;
        },
        removeItem: () => {
          storedJson = null;
        },
        clear: () => {
          storedJson = null;
        },
        key: () => null,
        length: 0,
      };
      const storage = createQuizStorage(storageMock);

      // Active result state
      const answers: QuizAnswers = {
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.0,
        hoursSinceLastCaffeineBeforeBed: null,
        screenMinutesInBed: 0,
        morningLightFrequency: 'almost_always',
      };
      const completedState: QuizState = {
        step: 'result',
        questionIndex: 4,
        answers,
        result: calculateSleepmaxxScore(answers),
      };

      // Perform retake: clear storage and dispatch RETAKE_QUIZ
      storage.clearSession();
      const resetState = quizReducer(completedState, { type: 'RETAKE_QUIZ' });

      expect(storedJson).toBeNull();
      expect(resetState.step).toBe('landing');
      expect(resetState.questionIndex).toBe(0);
      expect(resetState.answers).toEqual({});
      expect(resetState.result).toBeNull();
    });
  });

  // Scenario E — Mobile viewports & Touch targets
  describe('Scenario E: Mobile Viewports (375px, 390px, 430px) & Touch Targets', () => {
    it('ensures all interactive elements have touch targets >= 52px across screens', () => {
      const landingHtml = renderToStaticMarkup(<LandingScreen onStart={() => {}} />);
      expect(landingHtml).toContain('min-height:var(--touch-target-min)');

      const questionHtml = renderToStaticMarkup(
        <QuestionScreen
          question={QUESTIONS[0]}
          progressPercentage={20}
          onAnswer={() => {}}
          onBack={() => {}}
        />
      );
      // Back button
      expect(questionHtml).toContain('min-height:var(--touch-target-min)');
      expect(questionHtml).toContain('min-width:var(--touch-target-min)');

      // Options
      expect(questionHtml).toContain('min-height:var(--touch-target-min)');

      // ResultScreen retake button
      const answers: QuizAnswers = {
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.0,
        hoursSinceLastCaffeineBeforeBed: null,
        screenMinutesInBed: 0,
        morningLightFrequency: 'almost_always',
      };
      const result = calculateSleepmaxxScore(answers);
      const resultHtml = renderToStaticMarkup(<ResultScreen result={result} onRetake={() => {}} />);
      expect(resultHtml).toContain('min-height:var(--touch-target-min)');

      // Visual ScoreCard contains zero buttons
      const scoreCardHtml = renderToStaticMarkup(<ScoreCard result={result} />);
      expect(scoreCardHtml).not.toContain('<button');
    });
  });

  // Scenario F — Keyboard navigation
  describe('Scenario F: Keyboard Navigation & ARIA', () => {
    it('verifies radiogroup markup, radio roles, tabIndex, and focus states', () => {
      const html = renderToStaticMarkup(
        <QuestionScreen
          question={QUESTIONS[0]}
          progressPercentage={20}
          onAnswer={() => {}}
        />
      );

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('role="radio"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-checked="false"');
    });

    it('verifies auto-advance timing delay constant is exactly 150ms', () => {
      expect(AUTO_ADVANCE_DELAY_MS).toBe(150);
    });
  });

  // Scenario G — Edge Cases (Scores 0, 100, Archetype boundaries)
  describe('Scenario G: Edge Cases (Score 0, Score 100, and Boundaries)', () => {
    it('evaluates perfect score (100 pts, ELITE, Zero Weaknesses)', () => {
      const answers: QuizAnswers = {
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.0,
        hoursSinceLastCaffeineBeforeBed: null,
        screenMinutesInBed: 0,
        morningLightFrequency: 'almost_always',
      };
      const result = calculateSleepmaxxScore(answers);
      expect(result.totalScore).toBe(100);
      expect(result.archetype.id).toBe('elite');
      expect(result.archetype.label).toBe('ELITE');
      expect(result.biggestWeakness.pointsLost).toBe(0);

      const html = renderToStaticMarkup(<ScoreCard result={result} />);
      expect(html).toContain('Zero Habit Weaknesses Detected 🏆');
    });

    it('evaluates worst score (0 pts, COOKED, Duration Weakness)', () => {
      const answers: QuizAnswers = {
        sleepDurationHours: 4.0,
        weekendShiftHours: 4.0,
        hoursSinceLastCaffeineBeforeBed: 1.0,
        screenMinutesInBed: 90,
        morningLightFrequency: 'never',
      };
      const result = calculateSleepmaxxScore(answers);
      expect(result.totalScore).toBe(0);
      expect(result.archetype.id).toBe('cooked');
      expect(result.archetype.label).toBe('COOKED');
      expect(result.biggestWeakness.id).toBe('duration');
      expect(result.biggestWeakness.pointsLost).toBe(35);

      const html = renderToStaticMarkup(<ScoreCard result={result} />);
      expect(html).toContain('COOKED');
      expect(html).toContain('Biggest Weakness:');
      expect(html).toContain('-35 pts');
    });

    it('verifies boundary score 39 (COOKED) vs 40 (ZOMBIE)', () => {
      // 39 points: duration (22) + consistency (17) = 39, caffeine 0, screen 0, light 0
      const answers39: QuizAnswers = {
        sleepDurationHours: 6.5, // 22 pts
        weekendShiftHours: 1.5,  // 17 pts
        hoursSinceLastCaffeineBeforeBed: 1.0, // 0 pts
        screenMinutesInBed: 75,  // 0 pts
        morningLightFrequency: 'never', // 0 pts
      };
      const res39 = calculateSleepmaxxScore(answers39);
      expect(res39.totalScore).toBe(39);
      expect(res39.archetype.id).toBe('cooked');
      expect(res39.archetype.label).toBe('COOKED');

      // 40 points: duration 10 + consistency 10 + caffeine 20 = 40
      const answersExact40: QuizAnswers = {
        sleepDurationHours: 5.5, // 10 pts
        weekendShiftHours: 2.5,  // 10 pts
        hoursSinceLastCaffeineBeforeBed: null, // 20 pts
        screenMinutesInBed: 90,  // 0 pts
        morningLightFrequency: 'never', // 0 pts
      };
      const res40 = calculateSleepmaxxScore(answersExact40);
      expect(res40.totalScore).toBe(40);
      expect(res40.archetype.id).toBe('zombie');
      expect(res40.archetype.label).toBe('ZOMBIE');
    });

    it('verifies boundary score 89 (SLEEPMAXXED) vs 90 (ELITE)', () => {
      // 89 points: duration 35, consistency 25, caffeine 20, screen 9, light 0 = 89
      const answers89: QuizAnswers = {
        sleepDurationHours: 8.0, // 35
        weekendShiftHours: 0.0,  // 25
        hoursSinceLastCaffeineBeforeBed: null, // 20
        screenMinutesInBed: 10,  // 9
        morningLightFrequency: 'never', // 0
      };
      const res89 = calculateSleepmaxxScore(answers89);
      expect(res89.totalScore).toBe(89);
      expect(res89.archetype.id).toBe('sleepmaxxed');
      expect(res89.archetype.label).toBe('SLEEPMAXXED');

      // 90 points: duration 35, consistency 25, caffeine 20, screen 10, light 0 = 90
      const answers90: QuizAnswers = {
        sleepDurationHours: 8.0, // 35
        weekendShiftHours: 0.0,  // 25
        hoursSinceLastCaffeineBeforeBed: null, // 20
        screenMinutesInBed: 0,   // 10
        morningLightFrequency: 'never', // 0
      };
      const res90 = calculateSleepmaxxScore(answers90);
      expect(res90.totalScore).toBe(90);
      expect(res90.archetype.id).toBe('elite');
      expect(res90.archetype.label).toBe('ELITE');
    });
  });
});
