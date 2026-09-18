import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { QuizQuestion, QuizOptionItem, QuizAnswers } from '../types';
import { TOTAL_QUESTIONS } from '../data/questions';
import { ProgressBar } from './ProgressBar';

export const AUTO_ADVANCE_DELAY_MS = 150;

export interface QuestionScreenProps {
  readonly question: QuizQuestion;
  readonly progressPercentage: number;
  readonly onAnswer: (value: QuizAnswers[keyof QuizAnswers]) => void;
  readonly onBack?: () => void;
}

export const QuestionScreen: React.FC<QuestionScreenProps> = ({
  question,
  progressPercentage,
  onAnswer,
  onBack,
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const isTransitioningRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local state and timer when question changes
  useEffect(() => {
    setSelectedOptionId(null);
    isTransitioningRef.current = false;

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [question.id]);

  const handleSelect = useCallback(
    (option: QuizOptionItem<QuizAnswers[keyof QuizAnswers]>) => {
      // Anti-multitap gate: ignore additional taps during transition
      if (isTransitioningRef.current) return;

      isTransitioningRef.current = true;
      setSelectedOptionId(option.id);

      timerRef.current = setTimeout(() => {
        onAnswer(option.normalizedValue);
      }, AUTO_ADVANCE_DELAY_MS);
    },
    [onAnswer]
  );

  return (
    <div
      className="question-screen"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        padding: 'var(--space-md) 0 var(--space-xl) 0',
      }}
    >
      <div
        className="question-header-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-sm)',
        }}
      >
        {onBack && question.stepNumber > 0 && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Previous question"
            disabled={isTransitioningRef.current}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              padding: '0 var(--space-xs)',
              minHeight: '40px',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            ←
          </button>
        )}
        <div style={{ flex: 1 }}>
          <ProgressBar
            currentStep={question.stepNumber}
            totalSteps={TOTAL_QUESTIONS}
            progressPercentage={progressPercentage}
          />
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h2
          id={`question-title-${question.id}`}
          style={{
            fontSize: '1.375rem',
            fontWeight: 700,
            lineHeight: 1.3,
            color: 'var(--text-primary)',
            marginBottom: question.description ? 'var(--space-xs)' : 0,
          }}
        >
          {question.title}
        </h2>
        {question.description && (
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            {question.description}
          </p>
        )}
      </div>

      <div
        className="options-list"
        role="radiogroup"
        aria-labelledby={`question-title-${question.id}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-sm)',
        }}
      >
        {question.options.map((option) => {
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isTransitioningRef.current && !isSelected}
              onClick={() => handleSelect(option)}
              style={{
                width: '100%',
                minHeight: 'var(--touch-target-min)',
                padding: 'var(--space-sm) var(--space-md)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                textAlign: 'left',
                backgroundColor: isSelected
                  ? 'rgba(99, 102, 241, 0.2)'
                  : 'var(--bg-surface)',
                border: isSelected
                  ? '2px solid var(--accent-primary)'
                  : '1px solid var(--border-subtle)',
                boxShadow: isSelected ? 'var(--glow-accent)' : 'none',
                borderRadius: 'var(--radius-md)',
                color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                transition: 'all 0.12s ease-in-out',
                cursor: isTransitioningRef.current ? 'default' : 'pointer',
              }}
            >
              <span
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {option.label}
              </span>
              {option.sublabel && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                    marginTop: '2px',
                  }}
                >
                  {option.sublabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
