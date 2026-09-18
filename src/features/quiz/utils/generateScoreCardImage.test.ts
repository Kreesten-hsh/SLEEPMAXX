import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateScoreCardImage,
  renderScoreCardToCanvas,
  getScoreTierColor,
  wrapText,
  drawRoundRect,
  SCORECARD_IMAGE_WIDTH,
  SCORECARD_IMAGE_HEIGHT,
  SCORECARD_IMAGE_FILENAME,
  SCORECARD_IMAGE_MIME,
  SCORECARD_DISCLAIMER_TEXT,
  SCORECARD_WATERMARK_DOMAIN,
  SCORECARD_WATERMARK_EYEBROW,
  SCORECARD_CHALLENGE_TITLE,
  SCORECARD_CHALLENGE_SUBTITLE,
} from './generateScoreCardImage';
import type { SleepmaxxResult } from '../../../core/scoringEngine';

interface MockCanvasOptions {
  toBlobSuccess?: boolean;
  has2dContext?: boolean;
  hasToBlob?: boolean;
  hasRoundRect?: boolean;
}

function createMockCanvas(options: MockCanvasOptions = {}) {
  const {
    toBlobSuccess = true,
    has2dContext = true,
    hasToBlob = true,
    hasRoundRect = true,
  } = options;

  const filledTexts: { text: string; x: number; y: number }[] = [];
  const filledRects: { x: number; y: number; width: number; height: number }[] = [];
  const strokes: string[] = [];
  const colorStops: { offset: number; color: string }[] = [];

  const mockGradient = {
    addColorStop: vi.fn((offset: number, color: string) => {
      colorStops.push({ offset, color });
    }),
  };

  const mockContext = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    stroke: vi.fn(() => {
      strokes.push('stroke');
    }),
    fill: vi.fn(() => {
      strokes.push('fill');
    }),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) => {
      filledRects.push({ x, y, width, height });
    }),
    fillText: vi.fn((text: string, x: number, y: number) => {
      filledTexts.push({ text, x, y });
    }),
    measureText: vi.fn((text: string) => ({
      width: text.length * 10,
    })),
    createRadialGradient: vi.fn(() => mockGradient),
    roundRect: hasRoundRect
      ? vi.fn((x: number, y: number, width: number, height: number, _radius: number) => {
          filledRects.push({ x, y, width, height });
        })
      : undefined,
  } as unknown as CanvasRenderingContext2D;

  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn((contextId: string) => {
      if (contextId === '2d' && has2dContext) {
        return mockContext;
      }
      return null;
    }),
    toBlob: hasToBlob
      ? vi.fn((callback: (blob: Blob | null) => void, mimeType?: string) => {
          if (toBlobSuccess) {
            callback(new Blob(['mock-png-binary-stream'], { type: mimeType ?? 'image/png' }));
          } else {
            callback(null);
          }
        })
      : undefined,
  } as unknown as HTMLCanvasElement;

  return {
    canvas,
    mockContext,
    filledTexts,
    filledRects,
    colorStops,
  };
}

function createSampleResult(overrides: Partial<SleepmaxxResult> = {}): SleepmaxxResult {
  return {
    totalScore: 72,
    categories: {
      duration: { earned: 22, max: 35, lost: 13 },
      consistency: { earned: 17, max: 25, lost: 8 },
      caffeine: { earned: 18, max: 20, lost: 2 },
      screen: { earned: 8, max: 10, lost: 2 },
      morningLight: { earned: 7, max: 10, lost: 3 },
    },
    archetype: {
      id: 'recovering',
      label: 'RECOVERING',
    },
    biggestWeakness: {
      id: 'duration',
      label: 'Sleep Duration',
      pointsLost: 13,
    },
    ...overrides,
  };
}

describe('generateScoreCardImage: Pure Canvas 2D Asset Generator', () => {
  let mockCanvasBundle: ReturnType<typeof createMockCanvas>;

  beforeEach(() => {
    mockCanvasBundle = createMockCanvas();
  });

  // ─── 1. Output Dimensions ─────────────────────────────────────────
  it('calibrates canvas to exact 9:16 vertical resolution (1080 x 1920 px)', async () => {
    const result = createSampleResult();
    await generateScoreCardImage(result, { canvas: mockCanvasBundle.canvas });

    expect(mockCanvasBundle.canvas.width).toBe(1080);
    expect(mockCanvasBundle.canvas.height).toBe(1920);
    expect(SCORECARD_IMAGE_WIDTH).toBe(1080);
    expect(SCORECARD_IMAGE_HEIGHT).toBe(1920);
  });

  // ─── 2. Output File & MIME Contract ──────────────────────────────
  it('returns a valid File instance with correct name and PNG MIME type', async () => {
    const result = createSampleResult();
    const file = await generateScoreCardImage(result, { canvas: mockCanvasBundle.canvas });

    expect(file).toBeDefined();
    expect(file instanceof File).toBe(true);
    expect(file instanceof Blob).toBe(true);
    expect(file.name).toBe(SCORECARD_IMAGE_FILENAME);
    expect(file.name).toBe('sleepmaxx-score.png');
    expect(file.type).toBe(SCORECARD_IMAGE_MIME);
    expect(file.type).toBe('image/png');
  });

  // ─── 3. Score & Archetype Combinations ────────────────────────────
  it('renders representative archetype tiers with correct numeric scores and labels', async () => {
    const archetypes: { score: number; label: string }[] = [
      { score: 25, label: 'COOKED' },
      { score: 50, label: 'ZOMBIE' },
      { score: 68, label: 'RECOVERING' },
      { score: 82, label: 'SLEEPMAXXED' },
      { score: 96, label: 'ELITE' },
    ];

    for (const testCase of archetypes) {
      const bundle = createMockCanvas();
      const result = createSampleResult({
        totalScore: testCase.score,
        archetype: { id: testCase.label.toLowerCase() as any, label: testCase.label },
      });

      await generateScoreCardImage(result, { canvas: bundle.canvas });

      const texts = bundle.filledTexts.map((t) => t.text);
      expect(texts).toContain(String(testCase.score));
      expect(texts).toContain(testCase.label);
    }
  });

  // ─── 4. Tier Color Mapping ─────────────────────────────────────────
  it('maps score tiers to correct accent colors', () => {
    expect(getScoreTierColor(100)).toBe('#10B981'); // Emerald
    expect(getScoreTierColor(90)).toBe('#10B981');
    expect(getScoreTierColor(75)).toBe('#10B981');
    expect(getScoreTierColor(74)).toBe('#F59E0B');  // Amber
    expect(getScoreTierColor(60)).toBe('#F59E0B');
    expect(getScoreTierColor(59)).toBe('#EF4444');  // Rose
    expect(getScoreTierColor(40)).toBe('#EF4444');
    expect(getScoreTierColor(0)).toBe('#EF4444');
  });

  // ─── 5. Required Watermark & Brand Assets ──────────────────────────
  it('includes required brand watermark and domain in output', async () => {
    const result = createSampleResult();
    await generateScoreCardImage(result, { canvas: mockCanvasBundle.canvas });

    const texts = mockCanvasBundle.filledTexts.map((t) => t.text);
    expect(texts).toContain(SCORECARD_WATERMARK_DOMAIN);
    expect(texts).toContain('sleepmaxx.app');
    expect(texts).toContain(SCORECARD_WATERMARK_EYEBROW);
    expect(texts).toContain('SLEEPMAXX ROUTINE ENGINE');
  });

  // ─── 6. Challenge Hook & Tagline ──────────────────────────────────
  it('includes viral challenge tagline in output', async () => {
    const result = createSampleResult();
    await generateScoreCardImage(result, { canvas: mockCanvasBundle.canvas });

    const texts = mockCanvasBundle.filledTexts.map((t) => t.text);
    expect(texts).toContain(SCORECARD_CHALLENGE_TITLE);
    expect(texts).toContain('Can you reach 90 in 7 days?');
    expect(texts).toContain(SCORECARD_CHALLENGE_SUBTITLE);
    expect(texts).toContain('Take the free routine quiz on sleepmaxx.app');
  });

  // ─── 7. Mandatory Non-Medical Wellness Notice ──────────────────────
  it('renders the mandatory non-medical wellness disclaimer', async () => {
    expect(SCORECARD_DISCLAIMER_TEXT).toContain('Non-Medical Wellness Notice');
    const result = createSampleResult();
    await generateScoreCardImage(result, { canvas: mockCanvasBundle.canvas });

    const combinedText = mockCanvasBundle.filledTexts.map((t) => t.text).join(' ');
    expect(combinedText).toContain('Non-Medical Wellness Notice');
    expect(combinedText).toContain('does not measure clinical sleep stages');
    expect(combinedText).toContain('or provide medical diagnoses');
  });

  // ─── 8. Category Breakdown Rendering ──────────────────────────────
  it('renders all five category breakdown rows with earned/max and lost badges', async () => {
    const result = createSampleResult();
    await generateScoreCardImage(result, { canvas: mockCanvasBundle.canvas });

    const texts = mockCanvasBundle.filledTexts.map((t) => t.text);
    expect(texts).toContain('ROUTINE BREAKDOWN');
    expect(texts).toContain('Sleep Duration');
    expect(texts).toContain('22 / 35');
    expect(texts).toContain('-13');
    expect(texts).toContain('Weekend Schedule Shift');
    expect(texts).toContain('17 / 25');
    expect(texts).toContain('-8');
    expect(texts).toContain('Caffeine Timing');
    expect(texts).toContain('18 / 20');
    expect(texts).toContain('Screen Time in Bed');
    expect(texts).toContain('8 / 10');
    expect(texts).toContain('Morning Sunlight');
    expect(texts).toContain('7 / 10');
  });

  // ─── 9. Perfect Score (Zero Weaknesses) ───────────────────────────
  it('renders zero weakness victory message when pointsLost is 0', async () => {
    const result = createSampleResult({
      totalScore: 100,
      archetype: { id: 'elite', label: 'ELITE' },
      biggestWeakness: { id: 'duration', label: 'Sleep Duration', pointsLost: 0 },
      categories: {
        duration: { earned: 35, max: 35, lost: 0 },
        consistency: { earned: 25, max: 25, lost: 0 },
        caffeine: { earned: 20, max: 20, lost: 0 },
        screen: { earned: 10, max: 10, lost: 0 },
        morningLight: { earned: 10, max: 10, lost: 0 },
      },
    });

    await generateScoreCardImage(result, { canvas: mockCanvasBundle.canvas });

    const texts = mockCanvasBundle.filledTexts.map((t) => t.text);
    expect(texts).toContain('Zero Habit Weaknesses Detected 🏆');
    expect(texts).not.toContain('Biggest Weakness:');
  });

  // ─── 10. Boundary Score Inputs (Adversarial) ───────────────────────
  it('handles score boundaries (0, 39, 40, 59, 60, 74, 75, 89, 90, 100) without crashing', async () => {
    const boundaryScores = [0, 39, 40, 59, 60, 74, 75, 89, 90, 100];

    for (const score of boundaryScores) {
      const bundle = createMockCanvas();
      const result = createSampleResult({ totalScore: score });

      await expect(
        generateScoreCardImage(result, { canvas: bundle.canvas })
      ).resolves.toBeInstanceOf(File);

      expect(bundle.filledTexts.some((t) => t.text === String(score))).toBe(true);
    }
  });

  // ─── 11. Long Weakness & Text Overflow Safety ─────────────────────
  it('safely wraps and renders extremely long weakness text without throwing', async () => {
    const longLabel =
      'Extremely Long Sleep Schedule Irregularity And Massive Screen Usage Late At Night In Complete Darkness Without Any Filter';
    const result = createSampleResult({
      biggestWeakness: {
        id: 'duration',
        label: longLabel,
        pointsLost: 35,
      },
    });

    await expect(
      generateScoreCardImage(result, { canvas: mockCanvasBundle.canvas })
    ).resolves.toBeInstanceOf(File);

    const renderedTexts = mockCanvasBundle.filledTexts.map((t) => t.text).join(' ');
    expect(renderedTexts).toContain('Biggest Weakness:');
    expect(renderedTexts).toContain('-35 pts');
  });

  // ─── 12. Fallback roundRect Support ───────────────────────────────
  it('falls back gracefully to manual arcTo when native ctx.roundRect is absent', () => {
    const bundle = createMockCanvas({ hasRoundRect: false });
    const result = createSampleResult();

    expect(() => {
      renderScoreCardToCanvas(bundle.mockContext, result);
      drawRoundRect(bundle.mockContext, 0, 0, 100, 100, 10);
    }).not.toThrow();

    expect(bundle.mockContext.arcTo).toHaveBeenCalled();
  });

  // ─── 13. wrapText helper edge cases ───────────────────────────────
  it('handles empty strings and unbroken giant words in wrapText', () => {
    const bundle = createMockCanvas();
    expect(wrapText(bundle.mockContext, '', 100)).toEqual([]);

    const giantWord = 'SUPER_CALIFRAGILISTIC_EXPIALIDOCIOUS_LONG_STRING_THAT_EXCEEDS_MAX_WIDTH';
    const lines = wrapText(bundle.mockContext, giantWord, 100);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe(giantWord);
  });

  // ─── 14. Repeated Invocations (Deterministic) ─────────────────────
  it('generates consistent output on repeated calls without state leakage', async () => {
    const result = createSampleResult({ totalScore: 88 });

    const bundle1 = createMockCanvas();
    const bundle2 = createMockCanvas();

    await generateScoreCardImage(result, { canvas: bundle1.canvas });
    await generateScoreCardImage(result, { canvas: bundle2.canvas });

    const texts1 = bundle1.filledTexts.map((t) => t.text);
    const texts2 = bundle2.filledTexts.map((t) => t.text);

    expect(texts1).toEqual(texts2);
  });

  // ─── 15. Canvas Export Failure Handling ───────────────────────────
  it('rejects with descriptive error when canvas.toBlob returns null', async () => {
    const failCanvas = createMockCanvas({ toBlobSuccess: false }).canvas;
    const result = createSampleResult();

    await expect(generateScoreCardImage(result, { canvas: failCanvas })).rejects.toThrow(
      'Failed to export canvas to PNG blob'
    );
  });

  // ─── 16. Missing Canvas 2D Context ────────────────────────────────
  it('rejects with descriptive error when getContext("2d") returns null', async () => {
    const nullCtxCanvas = createMockCanvas({ has2dContext: false }).canvas;
    const result = createSampleResult();

    await expect(generateScoreCardImage(result, { canvas: nullCtxCanvas })).rejects.toThrow(
      'Unable to get 2D context from canvas'
    );
  });

  // ─── 17. Missing toBlob Method ────────────────────────────────────
  it('rejects when canvas.toBlob is not a function', async () => {
    const noBlobCanvas = createMockCanvas({ hasToBlob: false }).canvas;
    const result = createSampleResult();

    await expect(generateScoreCardImage(result, { canvas: noBlobCanvas })).rejects.toThrow(
      'Canvas toBlob is not supported'
    );
  });

  // ─── 18. Missing Document / Environment ───────────────────────────
  it('throws descriptive error when no canvas is passed and document is undefined', async () => {
    const originalDocument = globalThis.document;
    try {
      // @ts-expect-error simulating non-DOM environment
      delete globalThis.document;
      const result = createSampleResult();

      await expect(generateScoreCardImage(result)).rejects.toThrow(
        'Canvas element not available in this environment'
      );
    } finally {
      globalThis.document = originalDocument;
    }
  });

  // ─── 19. Headless Isolation (No DOM ScoreCard needed) ─────────────
  it('executes completely headlessly without requiring a rendered DOM ScoreCard', async () => {
    const result = createSampleResult();
    const file = await generateScoreCardImage(result, { canvas: mockCanvasBundle.canvas });

    expect(file).toBeInstanceOf(File);
    // Confirm no HTML button or UI controls were drawn
    const texts = mockCanvasBundle.filledTexts.map((t) => t.text.toLowerCase());
    expect(texts.some((t) => t.includes('retake quiz'))).toBe(false);
    expect(texts.some((t) => t.includes('share score'))).toBe(false);
  });
});
