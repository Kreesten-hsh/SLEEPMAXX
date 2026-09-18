import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScoreCard } from './ScoreCard';
import { ResultScreen } from './ResultScreen';
import { QuizContainer } from './QuizContainer';
import { quizReducer, INITIAL_QUIZ_STATE } from '../useQuizState';
import { createQuizStorage } from '../storage';
import { calculateSleepmaxxScore } from '../../../core/scoringEngine';
import type { SleepmaxxResult, QuizState } from '../types';
import type { QuizAnswers } from '../../../core/scoringEngine';

describe('User Story 4: ScoreCard Component & ResultScreen Integration (T022–T024)', () => {
  const perfectAnswers: QuizAnswers = {
    sleepDurationHours: 8.0,
    weekendShiftHours: 0.0,
    hoursSinceLastCaffeineBeforeBed: null,
    screenMinutesInBed: 0,
    morningLightFrequency: 'almost_always',
  };

  const worstAnswers: QuizAnswers = {
    sleepDurationHours: 4.5,
    weekendShiftHours: 3.5,
    hoursSinceLastCaffeineBeforeBed: 1.0,
    screenMinutesInBed: 75,
    morningLightFrequency: 'never',
  };

  const moderateAnswers: QuizAnswers = {
    sleepDurationHours: 6.5, // 20 / 35 -> lost 15
    weekendShiftHours: 1.5,  // 15 / 25 -> lost 10
    hoursSinceLastCaffeineBeforeBed: 5.0, // 10 / 20 -> lost 10
    screenMinutesInBed: 20,  // 6 / 10 -> lost 4
    morningLightFrequency: 'often', // 7 / 10 -> lost 3
  };

  const sampleResult: SleepmaxxResult = calculateSleepmaxxScore(moderateAnswers);

  // ─── Test 1: Score displayed ──────────────────────────────────────
  describe('Test 1 — Score displayed', () => {
    it('displays the exact numeric score and clear score label', () => {
      const html = renderToStaticMarkup(<ScoreCard result={sampleResult} />);

      expect(html).toContain('data-testid="score-value"');
      expect(html).toContain(`>${sampleResult.totalScore}</div>`);
      expect(html).toContain('out of 100 possible points');
    });

    it('renders the brand watermark above the score', () => {
      const html = renderToStaticMarkup(<ScoreCard result={sampleResult} />);

      expect(html).toContain('data-testid="brand-watermark"');
      expect(html).toContain('Sleepmaxx Routine Score');
    });
  });

  // ─── Test 2: Archetype displayed ──────────────────────────────────
  describe('Test 2 — Archetype displayed', () => {
    it('displays the archetype label matching the score result', () => {
      const html = renderToStaticMarkup(<ScoreCard result={sampleResult} />);

      expect(html).toContain('data-testid="archetype-badge"');
      expect(html).toContain(sampleResult.archetype.label);
    });

    it('applies the appropriate theme color for the archetype tier', () => {
      const eliteResult = calculateSleepmaxxScore(perfectAnswers);
      const eliteHtml = renderToStaticMarkup(<ScoreCard result={eliteResult} />);
      expect(eliteHtml).toContain('var(--accent-emerald)');

      const worstResult = calculateSleepmaxxScore(worstAnswers);
      const worstHtml = renderToStaticMarkup(<ScoreCard result={worstResult} />);
      expect(worstHtml).toContain('var(--accent-rose)');
    });
  });

  // ─── Test 3: Biggest weakness displayed ───────────────────────────
  describe('Test 3 — Biggest weakness displayed', () => {
    it('displays the primary weakness and deducted points when pointsLost > 0', () => {
      const html = renderToStaticMarkup(<ScoreCard result={sampleResult} />);

      expect(html).toContain('data-testid="weakness-badge"');
      expect(html).toContain('Biggest Weakness:');
      expect(html).toContain(sampleResult.biggestWeakness.label);
      expect(html).toContain(`(-${sampleResult.biggestWeakness.pointsLost} pts)`);
    });

    it('displays "Zero Habit Weaknesses Detected 🏆" when score is perfect and pointsLost === 0', () => {
      const eliteResult = calculateSleepmaxxScore(perfectAnswers);
      const html = renderToStaticMarkup(<ScoreCard result={eliteResult} />);

      expect(html).toContain('data-testid="weakness-badge"');
      expect(html).toContain('Zero Habit Weaknesses Detected 🏆');
    });
  });

  // ─── Test 4: Breakdown displayed ──────────────────────────────────
  describe('Test 4 — Breakdown displayed', () => {
    it('renders all five category sections with proper labels and earned/max points', () => {
      const html = renderToStaticMarkup(<ScoreCard result={sampleResult} />);

      expect(html).toContain('Routine Breakdown');
      expect(html).toContain('Sleep Duration');
      expect(html).toContain('Weekend Schedule Shift');
      expect(html).toContain('Caffeine Timing');
      expect(html).toContain('Screen Time in Bed');
      expect(html).toContain('Morning Sunlight');

      expect(html).toContain(`${sampleResult.categories.duration.earned} / ${sampleResult.categories.duration.max}`);
      expect(html).toContain(`${sampleResult.categories.consistency.earned} / ${sampleResult.categories.consistency.max}`);
      expect(html).toContain(`${sampleResult.categories.caffeine.earned} / ${sampleResult.categories.caffeine.max}`);
      expect(html).toContain(`${sampleResult.categories.screen.earned} / ${sampleResult.categories.screen.max}`);
      expect(html).toContain(`${sampleResult.categories.morningLight.earned} / ${sampleResult.categories.morningLight.max}`);
    });

    it('renders point deduction badges only when points are lost', () => {
      const eliteResult = calculateSleepmaxxScore(perfectAnswers);
      const eliteHtml = renderToStaticMarkup(<ScoreCard result={eliteResult} />);
      // Perfect score has 0 lost points across all categories
      expect(eliteHtml).not.toContain('>-');

      const html = renderToStaticMarkup(<ScoreCard result={sampleResult} />);
      expect(html).toContain(`-${sampleResult.categories.duration.lost}`);
    });
  });

  // ─── Test 5: Disclaimer ───────────────────────────────────────────
  describe('Test 5 — Disclaimer', () => {
    it('displays the non-clinical, non-medical wellness notice', () => {
      const html = renderToStaticMarkup(<ScoreCard result={sampleResult} />);

      expect(html).toContain('Non-Medical Wellness Notice');
      expect(html).toContain(
        'Sleepmaxx is a gamified routine evaluator based on self-declared habits. It does not measure clinical sleep stages, hormones, or provide medical diagnoses.'
      );
    });

    it('does not contain prohibited medical or clinical claims', () => {
      const html = renderToStaticMarkup(<ScoreCard result={sampleResult} />);

      expect(html).not.toContain('medical score');
      expect(html).not.toContain('health diagnosis');
      expect(html).not.toContain('optimal sleep');
      expect(html).not.toContain('hormonal optimization');
      expect(html).not.toContain('cortisol optimization');
      expect(html).not.toContain('melatonin optimization');
    });
  });

  // ─── Test 6: Integration result ───────────────────────────────────
  describe('Test 6 — Integration result', () => {
    it('ResultScreen renders ScoreCard with all expected test IDs and container classes', () => {
      const onRetake = vi.fn();
      const html = renderToStaticMarkup(
        <ResultScreen result={sampleResult} onRetake={onRetake} />
      );

      expect(html).toContain('class="scorecard-container"');
      expect(html).toContain('data-testid="scorecard-container"');
      expect(html).toContain('data-testid="brand-watermark"');
      expect(html).toContain('data-testid="score-value"');
      expect(html).toContain('data-testid="archetype-badge"');
      expect(html).toContain('data-testid="weakness-badge"');
      expect(html).toContain('Retake Quiz');
    });

    it('QuizContainer renders ScoreCard via ResultScreen when session reaches result step', () => {
      const mockStorage = createQuizStorage({
        getItem: () =>
          JSON.stringify({
            version: 1,
            step: 'result',
            questionIndex: 4,
            answers: moderateAnswers,
            result: sampleResult,
            updatedAt: Date.now(),
          }),
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 1,
      });

      const html = renderToStaticMarkup(<QuizContainer storageAdapter={mockStorage} />);
      expect(html).toContain('class="scorecard-container"');
      expect(html).toContain('data-testid="score-value"');
      expect(html).toContain(String(sampleResult.totalScore));
      expect(html).toContain(sampleResult.archetype.label);
    });
  });

  // ─── Test 7: Retake regression ────────────────────────────────────
  describe('Test 7 — Retake regression', () => {
    it('allows retake from ResultScreen to reset state to initial landing step', () => {
      let state: QuizState = {
        step: 'result',
        questionIndex: 4,
        answers: moderateAnswers,
        result: sampleResult,
      };

      // Dispatches RETAKE_QUIZ as invoked by onRetake handler
      state = quizReducer(state, { type: 'RETAKE_QUIZ' });

      expect(state.step).toBe('landing');
      expect(state.questionIndex).toBe(0);
      expect(state.answers).toEqual({});
      expect(state.result).toBeNull();
      expect(state).toEqual(INITIAL_QUIZ_STATE);
    });

    it('ScoreCard renders Retake button only when onRetake prop is provided', () => {
      const withoutRetake = renderToStaticMarkup(<ScoreCard result={sampleResult} />);
      expect(withoutRetake).not.toContain('Retake Quiz');

      const onRetake = vi.fn();
      const withRetake = renderToStaticMarkup(
        <ScoreCard result={sampleResult} onRetake={onRetake} />
      );
      expect(withRetake).toContain('Retake Quiz');
    });
  });

  // ─── Test 8: Extreme scores ───────────────────────────────────────
  describe('Test 8 — Extreme scores', () => {
    it('renders properly for maximum possible score (100 / ELITE)', () => {
      const eliteResult = calculateSleepmaxxScore(perfectAnswers);
      expect(eliteResult.totalScore).toBe(100);
      expect(eliteResult.archetype.id).toBe('elite');

      const html = renderToStaticMarkup(<ScoreCard result={eliteResult} />);
      expect(html).toContain('100');
      expect(html).toContain('ELITE');
      expect(html).toContain('Zero Habit Weaknesses Detected 🏆');
      expect(html).toContain('35 / 35');
      expect(html).toContain('25 / 25');
      expect(html).toContain('20 / 20');
      expect(html).toContain('10 / 10');
      expect(html).toContain('var(--accent-emerald)');
    });

    it('renders properly for minimum possible score (0 / COOKED)', () => {
      const cookedResult = calculateSleepmaxxScore(worstAnswers);
      expect(cookedResult.totalScore).toBe(0);
      expect(cookedResult.archetype.id).toBe('cooked');

      const html = renderToStaticMarkup(<ScoreCard result={cookedResult} />);
      expect(html).toContain('0');
      expect(html).toContain('COOKED');
      expect(html).toContain('Biggest Weakness:');
      expect(html).toContain('0 / 35');
      expect(html).toContain('0 / 25');
      expect(html).toContain('0 / 20');
      expect(html).toContain('0 / 10');
      expect(html).toContain('var(--accent-rose)');
    });
  });

  // ─── Test 9: Boundary values ──────────────────────────────────────
  describe('Test 9 — Boundary values', () => {
    it('renders correct badge and styling across all archetype boundary scores', () => {
      // Helper to generate a minimal valid SleepmaxxResult at any totalScore
      const createResultAtScore = (score: number, archetypeId: 'cooked' | 'zombie' | 'recovering' | 'sleepmaxxed' | 'elite', label: string): SleepmaxxResult => ({
        totalScore: score,
        categories: {
          duration: { earned: Math.min(35, score), max: 35, lost: 35 - Math.min(35, score) },
          consistency: { earned: 0, max: 25, lost: 25 },
          caffeine: { earned: 0, max: 20, lost: 20 },
          screen: { earned: 0, max: 10, lost: 10 },
          morningLight: { earned: 0, max: 10, lost: 10 },
        },
        archetype: { id: archetypeId, label },
        biggestWeakness: { id: 'consistency', label: 'Weekend Schedule Shift', pointsLost: 25 },
      });

      // Boundary 1: COOKED at upper bound 39
      const cooked39 = createResultAtScore(39, 'cooked', 'COOKED');
      const htmlCooked = renderToStaticMarkup(<ScoreCard result={cooked39} />);
      expect(htmlCooked).toContain('39');
      expect(htmlCooked).toContain('COOKED');
      expect(htmlCooked).toContain('var(--accent-rose)');

      // Boundary 2: ZOMBIE at lower bound 40 & upper bound 59
      const zombie40 = createResultAtScore(40, 'zombie', 'ZOMBIE');
      const htmlZombie40 = renderToStaticMarkup(<ScoreCard result={zombie40} />);
      expect(htmlZombie40).toContain('40');
      expect(htmlZombie40).toContain('ZOMBIE');
      expect(htmlZombie40).toContain('var(--accent-rose)');

      const zombie59 = createResultAtScore(59, 'zombie', 'ZOMBIE');
      const htmlZombie59 = renderToStaticMarkup(<ScoreCard result={zombie59} />);
      expect(htmlZombie59).toContain('59');
      expect(htmlZombie59).toContain('ZOMBIE');
      expect(htmlZombie59).toContain('var(--accent-rose)');

      // Boundary 3: RECOVERING at lower bound 60 & upper bound 74
      const recovering60 = createResultAtScore(60, 'recovering', 'RECOVERING');
      const htmlRecov60 = renderToStaticMarkup(<ScoreCard result={recovering60} />);
      expect(htmlRecov60).toContain('60');
      expect(htmlRecov60).toContain('RECOVERING');
      expect(htmlRecov60).toContain('var(--accent-amber)');

      const recovering74 = createResultAtScore(74, 'recovering', 'RECOVERING');
      const htmlRecov74 = renderToStaticMarkup(<ScoreCard result={recovering74} />);
      expect(htmlRecov74).toContain('74');
      expect(htmlRecov74).toContain('RECOVERING');
      expect(htmlRecov74).toContain('var(--accent-amber)');

      // Boundary 4: SLEEPMAXXED at lower bound 75 & upper bound 89
      const sleepmaxxed75 = createResultAtScore(75, 'sleepmaxxed', 'SLEEPMAXXED');
      const htmlSleep75 = renderToStaticMarkup(<ScoreCard result={sleepmaxxed75} />);
      expect(htmlSleep75).toContain('75');
      expect(htmlSleep75).toContain('SLEEPMAXXED');
      expect(htmlSleep75).toContain('var(--accent-emerald)');

      const sleepmaxxed89 = createResultAtScore(89, 'sleepmaxxed', 'SLEEPMAXXED');
      const htmlSleep89 = renderToStaticMarkup(<ScoreCard result={sleepmaxxed89} />);
      expect(htmlSleep89).toContain('89');
      expect(htmlSleep89).toContain('SLEEPMAXXED');
      expect(htmlSleep89).toContain('var(--accent-emerald)');

      // Boundary 5: ELITE at lower bound 90
      const elite90 = createResultAtScore(90, 'elite', 'ELITE');
      const htmlElite90 = renderToStaticMarkup(<ScoreCard result={elite90} />);
      expect(htmlElite90).toContain('90');
      expect(htmlElite90).toContain('ELITE');
      expect(htmlElite90).toContain('var(--accent-emerald)');
    });

    it('supports custom testId attribute on ScoreCard container', () => {
      const html = renderToStaticMarkup(
        <ScoreCard result={sampleResult} testId="custom-share-card" />
      );
      expect(html).toContain('data-testid="custom-share-card"');
    });

    it('accepts ref for future screenshot/canvas capture without DOM breakage', () => {
      const cardRef = createRef<HTMLDivElement>();
      // Rendering with ref in JSX
      const element = <ScoreCard ref={cardRef} result={sampleResult} />;
      expect(element.props.result).toBe(sampleResult);
      const html = renderToStaticMarkup(element);
      expect(html).toContain('class="scorecard-container"');
    });
  });
});
