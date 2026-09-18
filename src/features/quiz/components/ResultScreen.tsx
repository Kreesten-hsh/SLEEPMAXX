import React from 'react';
import type { SleepmaxxResult } from '../types';
import { ScoreCard } from './ScoreCard';

export interface ResultScreenProps {
  readonly result: SleepmaxxResult;
  readonly onRetake: () => void;
}


export const ResultScreen: React.FC<ResultScreenProps> = ({ result, onRetake }) => {
  return (
    <div
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
      <ScoreCard result={result} onRetake={onRetake} />
    </div>
  );
};
