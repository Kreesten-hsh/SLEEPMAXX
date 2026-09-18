import type { SleepmaxxResult } from '../../../core/scoringEngine';
import {
  generateScoreCardImage,
  SCORECARD_IMAGE_FILENAME,
  SCORECARD_IMAGE_MIME,
  type GenerateScoreCardOptions,
} from './generateScoreCardImage';

export { SCORECARD_IMAGE_FILENAME, SCORECARD_IMAGE_MIME };

export const DEFAULT_SHARE_TITLE = 'Sleepmaxx Routine Score';
export const DEFAULT_SHARE_URL = 'https://sleepmaxx.app';
export const GENERATION_FAILED_MESSAGE =
  'Unable to generate scorecard image. Please take a screenshot.';
export const DOWNLOAD_FAILED_MESSAGE = 'Unable to download scorecard image.';

export type ShareStatus =
  | 'shared'
  | 'downloaded'
  | 'downloaded_text_failed'
  | 'aborted'
  | 'generation_failed'
  | 'failed';

export interface ShareResult {
  readonly status: ShareStatus;
  readonly message?: string;
  readonly file?: File;
  readonly error?: unknown;
}

export interface ShareOptions {
  readonly title?: string;
  readonly text?: string;
  readonly url?: string;
  readonly generatorOptions?: GenerateScoreCardOptions;
  readonly generateImage?: (
    result: SleepmaxxResult,
    options?: GenerateScoreCardOptions
  ) => Promise<File>;
}

export function buildShareSummary(result: SleepmaxxResult): string {
  return `I scored ${result.totalScore}/100 on Sleepmaxx (${result.archetype.label}). Can you reach 90 in 7 days?`;
}

export function buildShareClipboardText(
  result: SleepmaxxResult,
  url: string = DEFAULT_SHARE_URL
): string {
  return `${buildShareSummary(result)} Test your routine on ${url}`;
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return (error as { name?: string }).name === 'AbortError';
}

/**
 * Checks whether Web Share Level 2 file sharing is confirmed by the browser.
 * Web Share must not be called without this capability confirmation.
 */
export function canShareFiles(file: File): boolean {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function'
  ) {
    return false;
  }

  try {
    return navigator.canShare({ files: [file] }) === true;
  } catch {
    return false;
  }
}

/**
 * Initiates programmatic download of the scorecard file and cleans up all DOM resources.
 */
export function downloadScoreCardFile(
  file: Blob | File,
  filename: string = SCORECARD_IMAGE_FILENAME
): boolean {
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return false;
  }

  let objectUrl = '';
  try {
    objectUrl = URL.createObjectURL(file);
  } catch {
    return false;
  }

  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = 'none';

    const container = document.body ?? document.documentElement;
    if (!container) {
      return false;
    }

    container.appendChild(anchor);

    try {
      anchor.click();
    } finally {
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
    }

    return true;
  } catch {
    return false;
  } finally {
    if (objectUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

/**
 * Copies companion text and URL to clipboard.
 * Distinguishes text copying from file download; must never claim the image was copied.
 */
export async function copyShareTextToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== 'function'
  ) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Defensive share orchestrator for the Sleepmaxx score result.
 *
 * Execution contract:
 * 1. Generates 9:16 PNG scorecard in memory via Canvas 2D.
 * 2. Checks navigator.canShare({ files: [file] }).
 * 3. Primary Path: invokes navigator.share({ title, text, files: [file] }).
 * 4. AbortError Isolation: if user cancels native share, returns { status: 'aborted' } with zero side effects.
 * 5. Fallback Path: if file sharing is unsupported or fails technically, downloads sleepmaxx-score.png
 *    and copies companion text to clipboard.
 * 6. Automated fallback to text-only navigator.share is strictly rejected to preserve visual asset delivery.
 */
export async function shareSleepmaxxScore(
  result: SleepmaxxResult,
  options?: ShareOptions
): Promise<ShareResult> {
  const generate = options?.generateImage ?? generateScoreCardImage;

  let imageFile: File;
  try {
    imageFile = await generate(result, options?.generatorOptions);
  } catch (error) {
    return {
      status: 'generation_failed',
      message: GENERATION_FAILED_MESSAGE,
      error,
    };
  }

  const title = options?.title ?? DEFAULT_SHARE_TITLE;
  const url = options?.url ?? DEFAULT_SHARE_URL;
  const companionText = options?.text ?? buildShareClipboardText(result, url);

  if (canShareFiles(imageFile)) {
    try {
      await navigator.share({
        title,
        text: companionText,
        files: [imageFile],
      });
      return {
        status: 'shared',
        file: imageFile,
      };
    } catch (shareError: unknown) {
      if (isAbortError(shareError)) {
        return {
          status: 'aborted',
          file: imageFile,
        };
      }
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(
          '[shareScore] Native file share failed, falling back to image download:',
          shareError
        );
      }
      // Non-abort technical error: proceed to download fallback without retrying text-only share
    }
  }

  const downloadSuccess = downloadScoreCardFile(imageFile, SCORECARD_IMAGE_FILENAME);
  if (!downloadSuccess) {
    return {
      status: 'failed',
      message: DOWNLOAD_FAILED_MESSAGE,
      file: imageFile,
    };
  }

  const clipboardSuccess = await copyShareTextToClipboard(companionText);
  if (clipboardSuccess) {
    return {
      status: 'downloaded',
      file: imageFile,
    };
  }

  return {
    status: 'downloaded_text_failed',
    file: imageFile,
  };
}
