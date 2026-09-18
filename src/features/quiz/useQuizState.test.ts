import { describe, it, expect } from 'vitest';
import {
  quizReducer,
  INITIAL_QUIZ_STATE,
  isCompleteQuizAnswers,
} from './useQuizState';
import type { QuizState, QuizAction } from './types';
import type { QuizAnswers } from '../../core/scoringEngine';

describe('quizReducer state machine', () => {
  it('has correct initial state matching data model', () => {
    expect(INITIAL_QUIZ_STATE).toEqual({
      step: 'landing',
      questionIndex: 0,
      answers: {},
      result: null,
    });
  });

  describe('START_QUIZ transition', () => {
    it('transitions from landing to question 0', () => {
      const nextState = quizReducer(INITIAL_QUIZ_STATE, { type: 'START_QUIZ' });
      expect(nextState).toEqual({
        step: 'question',
        questionIndex: 0,
        answers: {},
        result: null,
      });
    });

    it('is a no-op if already on question or result step', () => {
      const inQuizState: QuizState = {
        step: 'question',
        questionIndex: 2,
        answers: { sleepDurationHours: 8 },
        result: null,
      };
      expect(quizReducer(inQuizState, { type: 'START_QUIZ' })).toBe(inQuizState);
    });
  });

  describe('ANSWER_QUESTION progression and immutability', () => {
    it('records answer, increments questionIndex, and does not mutate previous state', () => {
      const state0: QuizState = {
        step: 'question',
        questionIndex: 0,
        answers: {},
        result: null,
      };

      const state1 = quizReducer(state0, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });

      expect(state0.answers).toEqual({}); // Immutability
      expect(state1.step).toBe('question');
      expect(state1.questionIndex).toBe(1);
      expect(state1.answers).toEqual({ sleepDurationHours: 8.0 });
      expect(state1.result).toBeNull();
    });

    it('preserves previously recorded answers as user advances', () => {
      const state1: QuizState = {
        step: 'question',
        questionIndex: 1,
        answers: { sleepDurationHours: 8.0 },
        result: null,
      };

      const state2 = quizReducer(state1, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 0.5 },
      });

      expect(state2.questionIndex).toBe(2);
      expect(state2.answers).toEqual({
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.5,
      });
    });

    it('allows correcting a previous answer while preserving downstream answers', () => {
      // User answered Q0, Q1, Q2 then navigated back to Q1
      const stateAtQ1: QuizState = {
        step: 'question',
        questionIndex: 1,
        answers: {
          sleepDurationHours: 8.0,
          weekendShiftHours: 0.5,
          hoursSinceLastCaffeineBeforeBed: 7.0,
        },
        result: null,
      };

      // Modifies Q1 from 0.5 to 0.0
      const correctedState = quizReducer(stateAtQ1, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'weekendShiftHours', value: 0.0 },
      });

      expect(correctedState.questionIndex).toBe(2);
      expect(correctedState.answers).toEqual({
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.0,
        hoursSinceLastCaffeineBeforeBed: 7.0,
      });
    });

    it('ignores ANSWER_QUESTION when not in question step', () => {
      const landingState = INITIAL_QUIZ_STATE;
      const nextState = quizReducer(landingState, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'sleepDurationHours', value: 8.0 },
      });
      expect(nextState).toBe(landingState);
    });
  });

  describe('PREVIOUS_QUESTION back navigation', () => {
    it('navigates from Q1 back to landing screen', () => {
      const stateAtQ0: QuizState = {
        step: 'question',
        questionIndex: 0,
        answers: {},
        result: null,
      };

      const backState = quizReducer(stateAtQ0, { type: 'PREVIOUS_QUESTION' });
      expect(backState).toEqual({
        step: 'landing',
        questionIndex: 0,
        answers: {},
        result: null,
      });
    });

    it('decrements questionIndex from Q2 to Q1 and preserves answers', () => {
      const stateAtQ1: QuizState = {
        step: 'question',
        questionIndex: 1,
        answers: { sleepDurationHours: 8.0 },
        result: null,
      };

      const backState = quizReducer(stateAtQ1, { type: 'PREVIOUS_QUESTION' });
      expect(backState.step).toBe('question');
      expect(backState.questionIndex).toBe(0);
      expect(backState.answers).toEqual({ sleepDurationHours: 8.0 });
    });

    it('decrements from Q4 to Q3 without issues', () => {
      const stateAtQ4: QuizState = {
        step: 'question',
        questionIndex: 4,
        answers: {
          sleepDurationHours: 8.0,
          weekendShiftHours: 0.0,
          hoursSinceLastCaffeineBeforeBed: null,
          screenMinutesInBed: 0,
        },
        result: null,
      };

      const backState = quizReducer(stateAtQ4, { type: 'PREVIOUS_QUESTION' });
      expect(backState.step).toBe('question');
      expect(backState.questionIndex).toBe(3);
    });

    it('never allows negative index or invalid state transitions', () => {
      const landingState = INITIAL_QUIZ_STATE;
      const afterBack = quizReducer(landingState, { type: 'PREVIOUS_QUESTION' });
      expect(afterBack).toBe(landingState);
    });
  });

  describe('Terminal scoring evaluation on Question 5', () => {
    const perfectAnswersExceptQ5 = {
      sleepDurationHours: 8.0,
      weekendShiftHours: 0.0,
      hoursSinceLastCaffeineBeforeBed: null,
      screenMinutesInBed: 0,
    };

    it('computes exact 100 ELITE score when perfect Q5 option is answered', () => {
      const stateAtQ4: QuizState = {
        step: 'question',
        questionIndex: 4,
        answers: perfectAnswersExceptQ5,
        result: null,
      };

      const finalState = quizReducer(stateAtQ4, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'morningLightFrequency', value: 'almost_always' },
      });

      expect(finalState.step).toBe('result');
      expect(finalState.questionIndex).toBe(4);
      expect(finalState.result).not.toBeNull();
      expect(finalState.result?.totalScore).toBe(100);
      expect(finalState.result?.archetype.id).toBe('elite');
      expect(finalState.result?.categories.duration.earned).toBe(35);
      expect(finalState.result?.categories.consistency.earned).toBe(25);
      expect(finalState.result?.categories.caffeine.earned).toBe(20);
      expect(finalState.result?.categories.screen.earned).toBe(10);
      expect(finalState.result?.categories.morningLight.earned).toBe(10);
    });

    it('computes exact 0 COOKED score when worst answers are submitted', () => {
      const worstAnswersExceptQ5 = {
        sleepDurationHours: 4.5,
        weekendShiftHours: 3.5,
        hoursSinceLastCaffeineBeforeBed: 1.0,
        screenMinutesInBed: 75,
      };

      const stateAtQ4: QuizState = {
        step: 'question',
        questionIndex: 4,
        answers: worstAnswersExceptQ5,
        result: null,
      };

      const finalState = quizReducer(stateAtQ4, {
        type: 'ANSWER_QUESTION',
        payload: { key: 'morningLightFrequency', value: 'never' },
      });

      expect(finalState.step).toBe('result');
      expect(finalState.result?.totalScore).toBe(0);
      expect(finalState.result?.archetype.id).toBe('cooked');
      expect(finalState.result?.biggestWeakness.id).toBe('duration'); // duration priority tie-break
    });
  });

  describe('RETAKE_QUIZ full reset', () => {
    it('completely purges answers and result and returns to landing at index 0', () => {
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
        result: {
          totalScore: 100,
          categories: {
            duration: { earned: 35, max: 35, lost: 0 },
            consistency: { earned: 25, max: 25, lost: 0 },
            caffeine: { earned: 20, max: 20, lost: 0 },
            screen: { earned: 10, max: 10, lost: 0 },
            morningLight: { earned: 10, max: 10, lost: 0 },
          },
          archetype: { id: 'elite', label: 'ELITE' },
          biggestWeakness: { id: 'duration', label: 'Sleep Duration', pointsLost: 0 },
        },
      };

      const resetState = quizReducer(completedState, { type: 'RETAKE_QUIZ' });
      expect(resetState).toEqual(INITIAL_QUIZ_STATE);
      expect(resetState.step).toBe('landing');
      expect(resetState.questionIndex).toBe(0);
      expect(resetState.answers).toEqual({});
      expect(resetState.result).toBeNull();
    });
  });

  describe('RESTORE_SESSION', () => {
    it('replaces the state with the restored payload', () => {
      const restoredPayload: QuizState = {
        step: 'question',
        questionIndex: 3,
        answers: {
          sleepDurationHours: 6.5,
          weekendShiftHours: 1.5,
          hoursSinceLastCaffeineBeforeBed: 5.0,
        },
        result: null,
      };

      const nextState = quizReducer(INITIAL_QUIZ_STATE, {
        type: 'RESTORE_SESSION',
        payload: restoredPayload,
      });

      expect(nextState).toEqual(restoredPayload);
    });
  });

  describe('Validation & Invariants helper', () => {
    it('isCompleteQuizAnswers correctly identifies complete vs partial answers', () => {
      const incomplete: Partial<QuizAnswers> = {
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.0,
      };
      expect(isCompleteQuizAnswers(incomplete)).toBe(false);

      const complete: QuizAnswers = {
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.0,
        hoursSinceLastCaffeineBeforeBed: null, // null is valid for zero caffeine
        screenMinutesInBed: 0,
        morningLightFrequency: 'almost_always',
      };
      expect(isCompleteQuizAnswers(complete)).toBe(true);
    });

    it('handles unexpected action gracefully', () => {
      const unknownAction = { type: 'UNKNOWN_ACTION' } as unknown as QuizAction;
      expect(quizReducer(INITIAL_QUIZ_STATE, unknownAction)).toBe(INITIAL_QUIZ_STATE);
    });
  });
});
