import React from 'react';
import type { SleepmaxxResult } from '../types';
import { ScoreCard } from './ScoreCard';

export interface ResultScreenProps {
  readonly result: SleepmaxxResult;
  readonly onRetake: () => void;
  readonly scoreCardRef?: React.Ref<HTMLDivElement>;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  result,
  onRetake,
  scoreCardRef,
}) => {
  return (
    <main
      className="result-screen"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        padding: 'var(--space-lg) 0 var(--space-2xl) 0',
        width: '100%',
      }}
    >
      {/* Pure Visual ScoreCard Surface */}
      <ScoreCard ref={scoreCardRef} result={result} />

      {/* Application Actions Container (Sibling to ScoreCard Surface) */}
      <div
        className="result-actions"
        data-testid="result-actions"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-md)',
          width: '100%',
          maxWidth: '440px',
          marginTop: 'var(--space-xl)',
        }}
      >
        {/* Placeholder structure prepared for future Share Score primary CTA (Phase 4 / Lot 2B) */}

        {/* Retake Quiz Action */}
        <button
          type="button"
          onClick={onRetake}
          className="retake-quiz-btn"
          data-testid="retake-quiz-btn"
          style={{
            width: '100%',
            maxWidth: '360px',
            minHeight: 'var(--touch-target-min)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-strong)',
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
          }}
        >
          Retake Quiz
        </button>

        {/* Live region structure prepared for future status announcements */}
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
          data-testid="result-status-live"
        />
      </div>
    </main>
  );
};
