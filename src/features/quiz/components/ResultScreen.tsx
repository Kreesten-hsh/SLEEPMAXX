import React, { useState, useRef } from 'react';
import type { SleepmaxxResult } from '../types';
import { ScoreCard } from './ScoreCard';
import { shareSleepmaxxScore } from '../utils/shareScore';

export interface ResultScreenProps {
  readonly result: SleepmaxxResult;
  readonly onRetake: () => void;
  readonly scoreCardRef?: React.Ref<HTMLDivElement>;
}

const SHARE_FEEDBACK_MESSAGES = {
  shared: 'ScoreCard shared successfully.',
  downloaded: 'ScoreCard image downloaded. Share link copied to clipboard.',
  downloaded_text_failed:
    'ScoreCard image downloaded. Could not copy share link to clipboard.',
  aborted: '',
  generation_failed: 'Unable to generate scorecard image. Please take a screenshot.',
  failed: 'Unable to download scorecard image.',
} as const;

function getShareFeedbackMessage(
  status: 'shared' | 'downloaded' | 'downloaded_text_failed' | 'aborted' | 'generation_failed' | 'failed',
  customMessage?: string
): string {
  if (status === 'generation_failed' && customMessage) {
    return customMessage;
  }
  if (status === 'failed' && customMessage) {
    return customMessage;
  }
  return SHARE_FEEDBACK_MESSAGES[status] ?? '';
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  result,
  onRetake,
  scoreCardRef,
}) => {
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const isShareInProgressRef = useRef<boolean>(false);

  const handleShare = async () => {
    // Gate double activation during active share processing
    if (isSharing || isShareInProgressRef.current) {
      return;
    }

    isShareInProgressRef.current = true;
    setIsSharing(true);

    try {
      const shareResult = await shareSleepmaxxScore(result);
      setStatusMessage(getShareFeedbackMessage(shareResult.status, shareResult.message));
    } catch {
      setStatusMessage(SHARE_FEEDBACK_MESSAGES.failed);
    } finally {
      isShareInProgressRef.current = false;
      setIsSharing(false);
    }
  };

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
        {/* Primary Action: Native Share Score CTA */}
        <button
          type="button"
          onClick={handleShare}
          disabled={isSharing}
          aria-busy={isSharing ? 'true' : undefined}
          className="share-score-btn"
          data-testid="share-score-btn"
          style={{
            width: '100%',
            maxWidth: '360px',
            minHeight: 'var(--touch-target-min)',
            backgroundColor: isSharing ? 'var(--bg-surface-elevated)' : 'var(--accent-primary)',
            color: '#FFFFFF',
            fontSize: '1rem',
            fontWeight: 700,
            borderRadius: 'var(--radius-md)',
            boxShadow: isSharing ? 'none' : 'var(--glow-accent)',
            cursor: isSharing ? 'not-allowed' : 'pointer',
            opacity: isSharing ? 0.7 : 1,
            transition: 'all 0.15s ease-in-out',
          }}
        >
          {isSharing ? 'Sharing…' : 'Share Score'}
        </button>

        {/* Secondary Action: Retake Quiz */}
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

        {/* Live region for accessible status announcements */}
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
          data-testid="result-status-live"
        >
          {statusMessage}
        </div>
      </div>
    </main>
  );
};
