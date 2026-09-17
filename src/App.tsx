

export default function App() {
  return (
    <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
      <h1>Sleepmaxx</h1>
      <p style={{ marginTop: 'var(--space-md)', opacity: 0.8 }}>
        Discover your Sleepmaxx Routine Score.
      </p>
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <button onClick={() => alert('React is working!')}>
          Start Routine Quiz
        </button>
      </div>
    </div>
  );
}
