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
  readonly selectedAnswer?: QuizAnswers[keyof QuizAnswers];
}

export const QuestionScreen: React.FC<QuestionScreenProps> = ({
  question,
  progressPercentage,
  onAnswer,
  onBack,
  selectedAnswer,
}) => {
  // Pure derivation of pre-selected option ID from a previously recorded answer
  const deriveSelectedOptionId = useCallback(
    (answer: QuizAnswers[keyof QuizAnswers] | undefined): string | null => {
      if (answer === undefined) return null;
      const match = question.options.find(
        (opt) => opt.normalizedValue === answer
      );
      return match?.id ?? null;
    },
    [question.options]
  );

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    () => deriveSelectedOptionId(selectedAnswer)
  );
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Synchronize state during render when question or selectedAnswer changes without cascading effect
  const [syncedKey, setSyncedKey] = useState({
    questionId: question.id,
    answer: selectedAnswer,
  });

  if (syncedKey.questionId !== question.id || syncedKey.answer !== selectedAnswer) {
    setSyncedKey({ questionId: question.id, answer: selectedAnswer });
    setSelectedOptionId(deriveSelectedOptionId(selectedAnswer));
    setIsTransitioning(false);
  }

  // Reset transition ref and cleanup pending timers on question/answer change or unmount
  useEffect(() => {
    isTransitioningRef.current = false;
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [question.id, selectedAnswer]);

  const handleSelect = useCallback(
    (option: QuizOptionItem<QuizAnswers[keyof QuizAnswers]>) => {
      // Anti-multitap gate: ignore additional taps during transition
      if (isTransitioningRef.current) return;

      isTransitioningRef.current = true;
      setIsTransitioning(true);
      setSelectedOptionId(option.id);

      timerRef.current = setTimeout(() => {
        onAnswer(option.normalizedValue);
      }, AUTO_ADVANCE_DELAY_MS);
    },
    [onAnswer]
  );

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLButtonElement>,
      index: number,
      option: QuizOptionItem<QuizAnswers[keyof QuizAnswers]>
    ) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect(option);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = (index + 1) % question.options.length;
        optionRefs.current[nextIndex]?.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = (index - 1 + question.options.length) % question.options.length;
        optionRefs.current[prevIndex]?.focus();
      }
    },
    [handleSelect, question.options.length]
  );

  return (
    <main
      className="question-screen"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        width: '100%',
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
            disabled={isTransitioning}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              minHeight: 'var(--touch-target-min)',
              minWidth: 'var(--touch-target-min)',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              cursor: isTransitioning ? 'default' : 'pointer',
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
            fontSize: 'clamp(1.125rem, 4vw, 1.375rem)',
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
        {question.options.map((option, index) => {
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              disabled={isTransitioning && !isSelected}
              onClick={() => handleSelect(option)}
              onKeyDown={(e) => handleKeyDown(e, index, option)}
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
                cursor: isTransitioning ? 'default' : 'pointer',
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
    </main>
  );
};
