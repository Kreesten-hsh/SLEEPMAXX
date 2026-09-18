import React from 'react';

export interface ProgressBarProps {
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly progressPercentage: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentStep,
  totalSteps,
  progressPercentage,
}) => {
  const clampedProgress = Math.min(Math.max(progressPercentage, 0), 100);

  return (
    <div className="progress-container" style={{ width: '100%', marginBottom: 'var(--space-md)' }}>
      <div
        className="progress-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-xs)',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          fontWeight: 500,
        }}
      >
        <span>
          Question {currentStep} of {totalSteps}
        </span>
        <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
          {clampedProgress}%
        </span>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Question ${currentStep} of ${totalSteps}`}
        style={{
          width: '100%',
          height: '6px',
          backgroundColor: 'var(--bg-surface-elevated)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          className="progress-fill"
          style={{
            width: `${clampedProgress}%`,
            height: '100%',
            backgroundColor: 'var(--accent-emerald)',
            boxShadow: 'var(--glow-emerald)',
            transition: 'width 0.25s ease-in-out',
          }}
        />
      </div>
    </div>
  );
};
