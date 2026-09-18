import React from 'react';

export interface LandingScreenProps {
  readonly onStart: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onStart }) => {
  return (
    <div
      className="landing-screen"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        flex: 1,
        padding: 'var(--space-xl) 0',
      }}
    >
      <div
        className="brand-badge"
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--accent-emerald)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '4px 12px',
          borderRadius: 'var(--radius-full)',
          marginBottom: 'var(--space-md)',
        }}
      >
        Sleepmaxx Routine Engine
      </div>

      <h1
        style={{
          fontSize: '2.25rem',
          fontWeight: 800,
          lineHeight: 1.15,
          marginBottom: 'var(--space-md)',
          letterSpacing: '-0.02em',
        }}
      >
        Discover your <span style={{ color: 'var(--accent-primary)' }}>Sleepmaxx Score</span>.
      </h1>

      <p
        style={{
          fontSize: '1.125rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: 'var(--space-lg)',
          maxWidth: '360px',
        }}
      >
        Can you reach 90 in 7 days? Take the 45-second routine assessment to uncover your archetype and biggest sleep habit weakness.
      </p>

      <div
        className="features-summary"
        style={{
          display: 'flex',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-2xl)',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
        }}
      >
        <span>⚡ 5 Questions</span>
        <span>•</span>
        <span>🎯 Instant Archetype</span>
        <span>•</span>
        <span>🔒 100% Free &amp; Private</span>
      </div>

      <button
        type="button"
        onClick={onStart}
        style={{
          width: '100%',
          maxWidth: '360px',
          minHeight: 'var(--touch-target-min)',
          backgroundColor: 'var(--accent-primary)',
          color: '#FFFFFF',
          fontSize: '1.125rem',
          fontWeight: 700,
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--glow-accent)',
        }}
      >
        Start Quiz
      </button>
    </div>
  );
};
