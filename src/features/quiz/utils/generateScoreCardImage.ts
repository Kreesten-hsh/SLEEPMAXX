import type { SleepmaxxResult, CategoryResult } from '../../../core/scoringEngine';

export const SCORECARD_IMAGE_WIDTH = 1080;
export const SCORECARD_IMAGE_HEIGHT = 1920;
export const SCORECARD_IMAGE_FILENAME = 'sleepmaxx-score.png';
export const SCORECARD_IMAGE_MIME = 'image/png';

export const SCORECARD_DISCLAIMER_TEXT =
  'Non-Medical Wellness Notice: Sleepmaxx is a gamified routine evaluator based on self-declared habits. It does not measure clinical sleep stages, hormones, or provide medical diagnoses.';

export const SCORECARD_WATERMARK_DOMAIN = 'sleepmaxx.app';
export const SCORECARD_WATERMARK_EYEBROW = 'SLEEPMAXX ROUTINE ENGINE';
export const SCORECARD_CHALLENGE_TITLE = 'Can you reach 90 in 7 days?';
export const SCORECARD_CHALLENGE_SUBTITLE = 'Take the free routine quiz on sleepmaxx.app';

export const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  duration: 'Sleep Duration',
  consistency: 'Weekend Schedule Shift',
  caffeine: 'Caffeine Timing',
  screen: 'Screen Time in Bed',
  morningLight: 'Morning Sunlight',
};

export interface GenerateScoreCardOptions {
  readonly canvas?: HTMLCanvasElement;
}

/**
 * Maps a Sleepmaxx routine score to its tier accent color:
 * >= 75: Emerald (#10B981)
 * 60 - 74: Amber (#F59E0B)
 * < 60: Rose (#EF4444)
 */
export function getScoreTierColor(score: number): string {
  if (score >= 75) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

/**
 * Draws a rounded rectangle path with fallback for environments lacking native roundRect.
 */
export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Safely breaks long text into lines fitting within maxWidth.
 * Handles overly long unbroken words without crashing or overflowing.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const wordWidth = ctx.measureText(word).width;

    if (wordWidth > maxWidth) {
      // Word itself exceeds maxWidth: flush existing line and break word character by character
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      for (const char of word) {
        const testCharLine = currentLine ? `${currentLine}${char}` : char;
        if (ctx.measureText(testCharLine).width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testCharLine;
        }
      }
      continue;
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Pure 2D rendering function that paints the complete Sleepmaxx ScoreCard onto a canvas context.
 * Strictly avoids reading from DOM, querySelector, or React components.
 */
export function renderScoreCardToCanvas(
  ctx: CanvasRenderingContext2D,
  result: SleepmaxxResult
): void {
  ctx.save();

  const tierColor = getScoreTierColor(result.totalScore);

  // 1. Deep dark background
  ctx.fillStyle = '#0B0F17';
  ctx.fillRect(0, 0, SCORECARD_IMAGE_WIDTH, SCORECARD_IMAGE_HEIGHT);

  // 2. Subtle radial glow behind score hero
  if (typeof ctx.createRadialGradient === 'function') {
    const glowGradient = ctx.createRadialGradient(540, 480, 0, 540, 480, 600);
    const rgb =
      result.totalScore >= 75
        ? '16, 185, 129'
        : result.totalScore >= 60
        ? '245, 158, 11'
        : '239, 68, 68';
    glowGradient.addColorStop(0, `rgba(${rgb}, 0.14)`);
    glowGradient.addColorStop(1, 'rgba(11, 15, 23, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, SCORECARD_IMAGE_WIDTH, 1000);
  }

  // 3. Top Header & Watermark
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText(SCORECARD_WATERMARK_EYEBROW, 540, 95);

  ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(SCORECARD_WATERMARK_DOMAIN, 540, 140);

  // 4. Score Hero Container
  const heroX = 60;
  const heroY = 190;
  const heroWidth = 960;
  const heroHeight = 530;

  drawRoundRect(ctx, heroX, heroY, heroWidth, heroHeight, 24);
  ctx.fillStyle = '#131B2A';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Score numeric display
  ctx.font = '900 180px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = tierColor;
  ctx.fillText(String(result.totalScore), 540, 360);

  // Subtitle
  ctx.font = '500 28px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('out of 100 possible points', 540, 430);

  // Archetype Pill
  const archeLabel = (result.archetype?.label ?? 'ZOMBIE').toUpperCase();
  ctx.font = '800 30px system-ui, -apple-system, sans-serif';
  const archeMetrics = ctx.measureText(archeLabel);
  const pillWidth = Math.max(280, archeMetrics.width + 64);
  const pillHeight = 64;
  const pillX = 540 - pillWidth / 2;
  const pillY = 465;

  drawRoundRect(ctx, pillX, pillY, pillWidth, pillHeight, 32);
  ctx.fillStyle = tierColor;
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(archeLabel, 540, pillY + pillHeight / 2);

  // Weakness Callout
  const weaknessBoxX = 100;
  const weaknessBoxY = 560;
  const weaknessBoxWidth = 880;
  const weaknessBoxHeight = 120;

  drawRoundRect(ctx, weaknessBoxX, weaknessBoxY, weaknessBoxWidth, weaknessBoxHeight, 14);

  if (result.biggestWeakness && result.biggestWeakness.pointsLost > 0) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '600 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Biggest Weakness:', 540, weaknessBoxY + 38);

    const weaknessDetail = `${result.biggestWeakness.label} (-${result.biggestWeakness.pointsLost} pts)`;
    ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#EF4444';
    // Wrap weakness detail if extremely long
    const wrappedWeakness = wrapText(ctx, weaknessDetail, weaknessBoxWidth - 40);
    if (wrappedWeakness.length <= 1) {
      ctx.fillText(weaknessDetail, 540, weaknessBoxY + 78);
    } else {
      ctx.fillText(wrappedWeakness[0], 540, weaknessBoxY + 68);
      ctx.fillText(wrappedWeakness[1], 540, weaknessBoxY + 98);
    }
  } else {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#10B981';
    ctx.fillText('Zero Habit Weaknesses Detected 🏆', 540, weaknessBoxY + weaknessBoxHeight / 2);
  }

  // 5. Routine Breakdown Section
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('ROUTINE BREAKDOWN', 60, 770);

  const categories = Object.entries(result.categories ?? {}) as [string, CategoryResult][];
  const startY = 800;
  const rowHeight = 104;
  const rowGap = 16;

  categories.forEach(([catKey, catResult], index) => {
    const rowY = startY + index * (rowHeight + rowGap);
    const label = CATEGORY_DISPLAY_LABELS[catKey] ?? catKey;
    const isPerfect = catResult.lost === 0;

    // Row card
    drawRoundRect(ctx, 60, rowY, 960, rowHeight, 16);
    ctx.fillStyle = '#131B2A';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Category title
    ctx.textAlign = 'left';
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(label, 90, rowY + 42);

    // Score ratio (right aligned)
    ctx.textAlign = 'right';
    ctx.font = '700 28px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isPerfect ? '#10B981' : '#94A3B8';
    const scoreRatioText = `${catResult.earned} / ${catResult.max}`;
    ctx.fillText(scoreRatioText, 990, rowY + 42);

    // Deduction tag if points lost
    if (catResult.lost > 0) {
      const ratioWidth = ctx.measureText(scoreRatioText).width;
      ctx.font = '700 24px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.fillText(`-${catResult.lost}`, 990 - ratioWidth - 16, rowY + 42);
    }

    // Progress bar track
    const barX = 90;
    const barY = rowY + 68;
    const barWidth = 900;
    const barHeight = 12;

    drawRoundRect(ctx, barX, barY, barWidth, barHeight, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();

    // Progress bar fill
    const fillFraction =
      catResult.max > 0 ? Math.max(0, Math.min(1, catResult.earned / catResult.max)) : 0;
    const fillWidth = fillFraction * barWidth;

    if (fillWidth > 0) {
      drawRoundRect(ctx, barX, barY, Math.max(fillWidth, 12), barHeight, 6);
      ctx.fillStyle = isPerfect ? '#10B981' : tierColor;
      ctx.fill();
    }
  });

  // 6. Challenge Hook / CTA Box
  const ctaX = 60;
  const ctaY = 1430;
  const ctaWidth = 960;
  const ctaHeight = 160;

  drawRoundRect(ctx, ctaX, ctaY, ctaWidth, ctaHeight, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#F8FAFC';
  ctx.fillText(SCORECARD_CHALLENGE_TITLE, 540, 1490);

  ctx.font = '600 26px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = tierColor;
  ctx.fillText(SCORECARD_CHALLENGE_SUBTITLE, 540, 1545);

  // 7. Non-Medical Wellness Disclaimer
  ctx.font = '400 20px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'center';

  const disclaimerLines = wrapText(ctx, SCORECARD_DISCLAIMER_TEXT, 920);
  const startDisclaimerY = 1690;
  const lineHeight = 32;

  disclaimerLines.forEach((line, index) => {
    ctx.fillText(line, 540, startDisclaimerY + index * lineHeight);
  });

  ctx.restore();
}

/**
 * Exports a canvas element to a PNG Blob.
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('Canvas toBlob is not supported'));
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to export canvas to PNG blob'));
        return;
      }
      resolve(blob);
    }, SCORECARD_IMAGE_MIME);
  });
}

/**
 * Headless, zero-dependency generator that creates the standardized 9:16 vertical PNG
 * ScoreCard image (1080 x 1920) directly in memory.
 *
 * @param result The immutable SleepmaxxResult payload.
 * @param options Optional overrides (e.g. mock canvas for test environments).
 * @returns A promise resolving to a File named 'sleepmaxx-score.png' with MIME 'image/png'.
 */
export async function generateScoreCardImage(
  result: SleepmaxxResult,
  options?: GenerateScoreCardOptions
): Promise<File> {
  const canvas =
    options?.canvas ??
    (typeof document !== 'undefined' && typeof document.createElement === 'function'
      ? document.createElement('canvas')
      : null);

  if (!canvas) {
    throw new Error('Canvas element not available in this environment');
  }

  canvas.width = SCORECARD_IMAGE_WIDTH;
  canvas.height = SCORECARD_IMAGE_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to get 2D context from canvas');
  }

  renderScoreCardToCanvas(ctx, result);

  const blob = await canvasToBlob(canvas);

  if (typeof File !== 'undefined') {
    return new File([blob], SCORECARD_IMAGE_FILENAME, { type: SCORECARD_IMAGE_MIME });
  }

  // Fallback for environments where File constructor is unavailable
  const fileFallback = blob as unknown as File;
  Object.defineProperties(fileFallback, {
    name: { value: SCORECARD_IMAGE_FILENAME },
    lastModified: { value: Date.now() },
  });
  return fileFallback;
}
