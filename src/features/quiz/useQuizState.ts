import { useReducer, useEffect, useMemo, useCallback } from 'react';
import { calculateSleepmaxxScore } from '../../core/scoringEngine';
import type { QuizAnswers } from '../../core/scoringEngine';
import type { QuizState, QuizAction, QuizQuestion, QuizAnswerPayload } from './types';
import { QUESTIONS, TOTAL_QUESTIONS } from './data/questions';
import { storage as defaultStorage, type QuizStorage } from './storage';

export const INITIAL_QUIZ_STATE: QuizState = {
  step: 'landing',
  questionIndex: 0,
  answers: {},
  result: null,
};

export function isCompleteQuizAnswers(answers: Partial<QuizAnswers>): answers is QuizAnswers {
  return (
    answers.sleepDurationHours !== undefined &&
    answers.weekendShiftHours !== undefined &&
    answers.hoursSinceLastCaffeineBeforeBed !== undefined &&
    answers.screenMinutesInBed !== undefined &&
    answers.morningLightFrequency !== undefined
  );
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'START_QUIZ': {
      if (state.step !== 'landing') return state;
      return {
        ...state,
        step: 'question',
        questionIndex: 0,
      };
    }

    case 'ANSWER_QUESTION': {
      if (state.step !== 'question') return state;

      const updatedAnswers: Partial<QuizAnswers> = {
        ...state.answers,
        [action.payload.key]: action.payload.value,
      };

      if (state.questionIndex < TOTAL_QUESTIONS - 1) {
        return {
          ...state,
          answers: updatedAnswers,
          questionIndex: state.questionIndex + 1,
        };
      }

      // Terminal question answered (Question 5, index 4)
      if (isCompleteQuizAnswers(updatedAnswers)) {
        const result = calculateSleepmaxxScore(updatedAnswers);
        return {
          step: 'result',
          questionIndex: TOTAL_QUESTIONS - 1,
          answers: updatedAnswers,
          result,
        };
      }

      // Fallback if not all 5 keys are present
      return {
        ...state,
        answers: updatedAnswers,
      };
    }

    case 'PREVIOUS_QUESTION': {
      if (state.step !== 'question') return state;

      if (state.questionIndex > 0) {
        return {
          ...state,
          questionIndex: state.questionIndex - 1,
        };
      }

      // If at Question 1 (index 0), navigating back returns to landing
      return {
        ...state,
        step: 'landing',
        questionIndex: 0,
      };
    }

    case 'RETAKE_QUIZ': {
      return INITIAL_QUIZ_STATE;
    }

    case 'RESTORE_SESSION': {
      return action.payload;
    }

    default:
      return state;
  }
}

export interface UseQuizStateReturn {
  readonly state: QuizState;
  readonly currentQuestion: QuizQuestion | null;
  readonly progressPercentage: number;
  readonly startQuiz: () => void;
  readonly answerCurrentQuestion: (value: QuizAnswers[keyof QuizAnswers]) => void;
  readonly goToPreviousQuestion: () => void;
  readonly retakeQuiz: () => void;
}

export function useQuizState(storageAdapter: QuizStorage = defaultStorage): UseQuizStateReturn {
  const [state, dispatch] = useReducer(quizReducer, INITIAL_QUIZ_STATE, (initial) => {
    return storageAdapter.loadSession() ?? initial;
  });

  useEffect(() => {
    storageAdapter.saveSession(state);
  }, [state, storageAdapter]);

  const startQuiz = useCallback(() => {
    dispatch({ type: 'START_QUIZ' });
  }, []);

  const goToPreviousQuestion = useCallback(() => {
    dispatch({ type: 'PREVIOUS_QUESTION' });
  }, []);

  const retakeQuiz = useCallback(() => {
    storageAdapter.clearSession();
    dispatch({ type: 'RETAKE_QUIZ' });
  }, [storageAdapter]);

  const currentQuestion = useMemo<QuizQuestion | null>(() => {
    if (state.step !== 'question') return null;
    return QUESTIONS[state.questionIndex] ?? null;
  }, [state.step, state.questionIndex]);

  const answerCurrentQuestion = useCallback(
    (value: QuizAnswers[keyof QuizAnswers]) => {
      if (!currentQuestion) return;
      const payload = {
        key: currentQuestion.answerKey,
        value,
      } as QuizAnswerPayload;

      dispatch({
        type: 'ANSWER_QUESTION',
        payload,
      });
    },
    [currentQuestion]
  );

  const progressPercentage = useMemo(() => {
    if (state.step === 'landing') return 0;
    if (state.step === 'result') return 100;
    return Math.round(((state.questionIndex + 1) / TOTAL_QUESTIONS) * 100);
  }, [state.step, state.questionIndex]);

  return {
    state,
    currentQuestion,
    progressPercentage,
    startQuiz,
    answerCurrentQuestion,
    goToPreviousQuestion,
    retakeQuiz,
  };
}
