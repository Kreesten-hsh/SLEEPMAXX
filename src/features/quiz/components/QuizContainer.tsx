import React from 'react';
import { useQuizState } from '../useQuizState';
import type { QuizStorage } from '../storage';
import { LandingScreen } from './LandingScreen';
import { QuestionScreen } from './QuestionScreen';
import { ResultScreen } from './ResultScreen';

export interface QuizContainerProps {
  readonly storageAdapter?: QuizStorage;
}

export const QuizContainer: React.FC<QuizContainerProps> = ({ storageAdapter }) => {
  const {
    state,
    currentQuestion,
    progressPercentage,
    startQuiz,
    answerCurrentQuestion,
    goToPreviousQuestion,
    retakeQuiz,
  } = useQuizState(storageAdapter);

  if (state.step === 'landing') {
    return <LandingScreen onStart={startQuiz} />;
  }

  if (state.step === 'question' && currentQuestion) {
    // Derive previously recorded answer for pre-selection on back navigation
    const previousAnswer = state.answers[currentQuestion.answerKey];

    return (
      <QuestionScreen
        question={currentQuestion}
        progressPercentage={progressPercentage}
        onAnswer={answerCurrentQuestion}
        onBack={goToPreviousQuestion}
        selectedAnswer={previousAnswer}
      />
    );
  }

  if (state.step === 'result' && state.result) {
    return <ResultScreen result={state.result} onRetake={retakeQuiz} />;
  }

  return null;
};
