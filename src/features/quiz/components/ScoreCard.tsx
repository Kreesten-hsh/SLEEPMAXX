import React from 'react';
import type { SleepmaxxResult, CategoryResult } from '../types';

export interface ScoreCardProps {
  readonly result: SleepmaxxResult;
  readonly onRetake?: () => void;
  readonly testId?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  duration: 'Sleep Duration',
  consistency: 'Weekend Schedule Shift',
  caffeine: 'Caffeine Timing',
  screen: 'Screen Time in Bed',
  morningLight: 'Morning Sunlight',
};

export const ScoreCard = React.forwardRef<HTMLDivElement, ScoreCardProps>(
  ({ result, onRetake, testId }, ref) => {
    const isHighScorer = result.totalScore >= 75;
    const isMidScorer = result.totalScore >= 60 && result.totalScore < 75;
    const scoreColor = isHighScorer
      ? 'var(--accent-emerald)'
      : isMidScorer
      ? 'var(--accent-amber)'
      : 'var(--accent-rose)';

    return (
      <div
        ref={ref}
        className="scorecard-container"
        data-testid={testId ?? 'scorecard-container'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '440px',
        }}
      >
        <div
          className="brand-watermark"
          data-testid="brand-watermark"
          style={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 'var(--space-md)',
            textAlign: 'center',
          }}
        >
          Sleepmaxx Routine Score
        </div>

        <div
          className="score-hero"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-xl) var(--space-lg)',
            width: '100%',
            marginBottom: 'var(--space-lg)',
            textAlign: 'center',
          }}
        >
          <div
            className="score-number"
            data-testid="score-value"
            style={{
              fontSize: '4.5rem',
              fontWeight: 900,
              lineHeight: 1,
              color: scoreColor,
              marginBottom: 'var(--space-xs)',
            }}
          >
            {result.totalScore}
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              marginBottom: 'var(--space-md)',
            }}
          >
            out of 100 possible points
          </div>

          <div
            className="archetype-badge"
            data-testid="archetype-badge"
            style={{
              display: 'inline-block',
              fontSize: '1rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              backgroundColor: scoreColor,
              padding: '6px 18px',
              borderRadius: 'var(--radius-full)',
              marginBottom: 'var(--space-md)',
            }}
          >
            {result.archetype.label}
          </div>

          {result.biggestWeakness.pointsLost > 0 ? (
            <div
              className="weakness-callout"
              data-testid="weakness-badge"
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Biggest Weakness:{' '}
              <strong style={{ color: 'var(--accent-rose)' }}>
                {result.biggestWeakness.label} (-{result.biggestWeakness.pointsLost} pts)
              </strong>
            </div>
          ) : (
            <div
              className="weakness-callout"
              data-testid="weakness-badge"
              style={{
                fontSize: '0.875rem',
                color: 'var(--accent-emerald)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Zero Habit Weaknesses Detected 🏆
            </div>
          )}
        </div>

        <div
          className="category-breakdown"
          style={{
            width: '100%',
            marginBottom: 'var(--space-xl)',
          }}
        >
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-sm)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Routine Breakdown
          </h3>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-xs)',
            }}
          >
            {(Object.entries(result.categories) as [string, CategoryResult][]).map(([catKey, catResult]) => {
              const label = CATEGORY_LABELS[catKey] ?? catKey;
              const isPerfect = catResult.lost === 0;

              return (
                <div
                  key={catKey}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: isPerfect ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                      }}
                    >
                      {catResult.earned} / {catResult.max}
                    </span>
                    {catResult.lost > 0 && (
                      <span style={{ color: 'var(--accent-rose)', fontSize: '0.75rem', fontWeight: 600 }}>
                        -{catResult.lost}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p
          className="disclaimer"
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            textAlign: 'center',
            marginBottom: onRetake ? 'var(--space-xl)' : '0',
            maxWidth: '380px',
          }}
        >
          Non-Medical Wellness Notice: Sleepmaxx is a gamified routine evaluator based on self-declared habits. It does not measure clinical sleep stages, hormones, or provide medical diagnoses.
        </p>

        {onRetake && (
          <button
            type="button"
            onClick={onRetake}
            className="scorecard-retake-btn"
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
            }}
          >
            Retake Quiz
          </button>
        )}
      </div>
    );
  }
);

ScoreCard.displayName = 'ScoreCard';
