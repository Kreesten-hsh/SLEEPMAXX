import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shareSleepmaxxScore,
  downloadScoreCardFile,
  copyShareTextToClipboard,
  canShareFiles,
  isAbortError,
  buildShareSummary,
  buildShareClipboardText,
  DEFAULT_SHARE_TITLE,
  GENERATION_FAILED_MESSAGE,
  DOWNLOAD_FAILED_MESSAGE,
  SCORECARD_IMAGE_FILENAME,
  SCORECARD_IMAGE_MIME,
} from './shareScore';
import type { SleepmaxxResult } from '../../../core/scoringEngine';

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

function createSamplePngFile(): File {
  return new File(['mock-png-bytes'], SCORECARD_IMAGE_FILENAME, {
    type: SCORECARD_IMAGE_MIME,
  });
}

describe('shareScore: Defensive Share Orchestrator (T005–T006)', () => {
  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;
  const originalURL = globalThis.URL;

  let shareSpy: ReturnType<typeof vi.fn>;
  let canShareSpy: ReturnType<typeof vi.fn>;
  let writeTextSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let anchorClickSpy: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeChildSpy: ReturnType<typeof vi.fn<(child: Node) => void>>;
  let createdAnchor: HTMLAnchorElement;
  let currentParent: ParentNode | null;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    shareSpy = vi.fn().mockResolvedValue(undefined);
    canShareSpy = vi.fn().mockReturnValue(true);
    writeTextSpy = vi.fn().mockResolvedValue(undefined);
    createObjectURLSpy = vi.fn().mockReturnValue('blob:http://localhost/mock-uuid-1234');
    revokeObjectURLSpy = vi.fn();
    anchorClickSpy = vi.fn();
    removeChildSpy = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    currentParent = null;

    // Mock DOM anchor
    createdAnchor = {
      href: '',
      download: '',
      style: { display: '' },
      click: anchorClickSpy,
      get parentNode(): ParentNode | null {
        return currentParent;
      },
    } as unknown as HTMLAnchorElement;

    const mockParent = {
      removeChild: vi.fn((child: Node) => {
        removeChildSpy(child);
        currentParent = null;
        return child;
      }),
    } as unknown as ParentNode;

    appendChildSpy = vi.fn((node: HTMLAnchorElement) => {
      currentParent = mockParent;
      return node;
    });

    // Global mocks
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        share: shareSpy,
        canShare: canShareSpy,
        clipboard: {
          writeText: writeTextSpy,
        },
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'document', {
      value: {
        body: {
          appendChild: appendChildSpy,
          removeChild: removeChildSpy,
        },
        documentElement: {},
        createElement: vi.fn((tagName: string) => {
          if (tagName === 'a') {
            return createdAnchor;
          }
          return {};
        }),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'URL', {
      value: {
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'URL', {
      value: originalURL,
      writable: true,
      configurable: true,
    });
  });

  describe('Pure Helper Functions', () => {
    it('buildShareSummary generates compliant score and archetype copy', () => {
      const summary = buildShareSummary(createSampleResult());
      expect(summary).toBe('I scored 72/100 on Sleepmaxx (RECOVERING). Can you reach 90 in 7 days?');
    });

    it('buildShareClipboardText appends the approved watermark domain/URL', () => {
      const text = buildShareClipboardText(createSampleResult());
      expect(text).toBe(
        'I scored 72/100 on Sleepmaxx (RECOVERING). Can you reach 90 in 7 days? Test your routine on https://sleepmaxx.app'
      );
    });

    it('isAbortError accurately detects AbortError instances', () => {
      const abortError = new Error('The user aborted the request.');
      abortError.name = 'AbortError';

      const notAllowedError = new Error('Permission denied.');
      notAllowedError.name = 'NotAllowedError';

      expect(isAbortError(abortError)).toBe(true);
      expect(isAbortError(notAllowedError)).toBe(false);
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError('AbortError')).toBe(false);
      expect(isAbortError({})).toBe(false);
    });
  });

  describe('Primary Path: Native Web Share with File', () => {
    it('calls navigator.share when canShare({ files }) returns true and returns shared status', async () => {
      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('shared');
      expect(result.file).toBe(mockFile);
      expect(canShareSpy).toHaveBeenCalledWith({ files: [mockFile] });
      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(shareSpy).toHaveBeenCalledWith({
        title: DEFAULT_SHARE_TITLE,
        text: expect.stringContaining('72/100 on Sleepmaxx (RECOVERING)'),
        files: [mockFile],
      });
    });

    it('verifies that the shared file is named sleepmaxx-score.png with image/png MIME type', async () => {
      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      const shareCallArgs = shareSpy.mock.calls[0][0];
      const fileArg = shareCallArgs.files[0];
      expect(fileArg.name).toBe('sleepmaxx-score.png');
      expect(fileArg.type).toBe('image/png');
    });

    it('does NOT trigger download fallback, clipboard write, or diagnostic on native success', async () => {
      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(createObjectURLSpy).not.toHaveBeenCalled();
      expect(anchorClickSpy).not.toHaveBeenCalled();
      expect(writeTextSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('integrates with default generateScoreCardImage when using generatorOptions canvas', async () => {
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          font: '',
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          textAlign: 'start',
          textBaseline: 'alphabetic',
          save: vi.fn(),
          restore: vi.fn(),
          beginPath: vi.fn(),
          closePath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          arcTo: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          fillRect: vi.fn(),
          fillText: vi.fn(),
          measureText: vi.fn(() => ({ width: 50 })),
          createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
          roundRect: vi.fn(),
        }),
        toBlob: vi.fn((callback: (blob: Blob) => void) => {
          callback(new Blob(['test-png-data'], { type: 'image/png' }));
        }),
      } as unknown as HTMLCanvasElement;

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generatorOptions: { canvas: mockCanvas },
      });

      expect(result.status).toBe('shared');
      expect(result.file).toBeDefined();
      expect(result.file?.name).toBe('sleepmaxx-score.png');
      expect(result.file?.type).toBe('image/png');
      expect(shareSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Unsupported Native File Sharing & Fallback Download', () => {
    it('triggers download fallback and clipboard copy when navigator.share is absent', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          clipboard: { writeText: writeTextSpy },
        },
        writable: true,
        configurable: true,
      });

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('downloaded');
      expect(createObjectURLSpy).toHaveBeenCalledWith(mockFile);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(createdAnchor.download).toBe('sleepmaxx-score.png');
      expect(writeTextSpy).toHaveBeenCalledTimes(1);
      expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining('https://sleepmaxx.app'));
    });

    it('triggers download fallback when navigator.canShare is absent', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          share: shareSpy,
          clipboard: { writeText: writeTextSpy },
        },
        writable: true,
        configurable: true,
      });

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('downloaded');
      expect(shareSpy).not.toHaveBeenCalled();
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(writeTextSpy).toHaveBeenCalledTimes(1);
    });

    it('triggers download fallback when canShare({ files }) returns false', async () => {
      canShareSpy.mockReturnValue(false);

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('downloaded');
      expect(canShareSpy).toHaveBeenCalledWith({ files: [mockFile] });
      expect(shareSpy).not.toHaveBeenCalled();
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(writeTextSpy).toHaveBeenCalledTimes(1);
    });

    it('NEVER attempts automated text-only navigator.share({ text, url }) as a fallback', async () => {
      canShareSpy.mockReturnValue(false);

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(shareSpy).not.toHaveBeenCalled();
    });

    it('returns downloaded_text_failed when image download succeeds but clipboard copy rejects', async () => {
      canShareSpy.mockReturnValue(false);
      writeTextSpy.mockRejectedValue(new Error('Clipboard write access denied'));

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('downloaded_text_failed');
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(writeTextSpy).toHaveBeenCalledTimes(1);
    });

    it('does not log native technical-share diagnostic when native file sharing is unsupported', async () => {
      canShareSpy.mockReturnValue(false);

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('downloaded');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('AbortError Isolation Contract', () => {
    it('returns status aborted and performs ZERO fallback side-effects when user cancels share sheet', async () => {
      const abortError = new Error('User cancelled share dialog.');
      abortError.name = 'AbortError';
      shareSpy.mockRejectedValue(abortError);

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('aborted');
      expect(result.file).toBe(mockFile);

      // Verify side-effect counters are strictly zero
      expect(createObjectURLSpy).not.toHaveBeenCalled();
      expect(anchorClickSpy).not.toHaveBeenCalled();
      expect(writeTextSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(shareSpy).toHaveBeenCalledTimes(1); // No second share attempt
    });
  });

  describe('Technical Native Share Error Handling', () => {
    it('attempts download fallback, companion clipboard copy, and logs diagnostic when native share rejects with non-Abort error', async () => {
      const technicalError = new Error('User gesture expired.');
      technicalError.name = 'NotAllowedError';
      shareSpy.mockRejectedValue(technicalError);

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('downloaded');
      expect(shareSpy).toHaveBeenCalledTimes(1); // Never retry text-only share
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(writeTextSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[shareScore] Native file share failed'),
        technicalError
      );
    });

    it('preserves successful download status (downloaded_text_failed) and logs diagnostic if clipboard fails after technical share rejection', async () => {
      const technicalError = new Error('Web Share backend internal failure.');
      shareSpy.mockRejectedValue(technicalError);
      writeTextSpy.mockRejectedValue(new Error('Permission denied'));

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('downloaded_text_failed');
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(writeTextSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[shareScore] Native file share failed'),
        technicalError
      );
    });
  });

  describe('Generation Failure Handling', () => {
    it('returns typed generation_failed result with required recovery message if generator rejects', async () => {
      const mockGenerate = vi.fn().mockRejectedValue(new Error('Canvas 2D context allocation failed'));

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('generation_failed');
      expect(result.message).toBe(GENERATION_FAILED_MESSAGE);
      expect(result.message).toBe('Unable to generate scorecard image. Please take a screenshot.');

      // Zero side-effects
      expect(shareSpy).not.toHaveBeenCalled();
      expect(createObjectURLSpy).not.toHaveBeenCalled();
      expect(anchorClickSpy).not.toHaveBeenCalled();
      expect(writeTextSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Browser Capability Edge Cases & Defensive Resilience', () => {
    it('handles complete absence of navigator without throwing unhandled rejection', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      // Navigator missing -> canShareFiles returns false -> triggers download -> clipboard missing -> downloaded_text_failed
      expect(result.status).toBe('downloaded_text_failed');
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    });

    it('handles missing clipboard API gracefully', async () => {
      canShareSpy.mockReturnValue(false);
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          share: shareSpy,
          canShare: canShareSpy,
          clipboard: undefined,
        },
        writable: true,
        configurable: true,
      });

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('downloaded_text_failed');
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    });

    it('handles canShare throwing an unexpected exception by falling back to download', async () => {
      canShareSpy.mockImplementation(() => {
        throw new TypeError('Failed to execute canShare on Navigator: parameter not a valid dictionary');
      });

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('downloaded');
      expect(shareSpy).not.toHaveBeenCalled();
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    });

    it('returns status failed when downloadScoreCardFile fails (e.g. createObjectURL throws)', async () => {
      canShareSpy.mockReturnValue(false);
      createObjectURLSpy.mockImplementation(() => {
        throw new Error('Not supported');
      });

      const mockFile = createSamplePngFile();
      const mockGenerate = vi.fn().mockResolvedValue(mockFile);

      const result = await shareSleepmaxxScore(createSampleResult(), {
        generateImage: mockGenerate,
      });

      expect(result.status).toBe('failed');
      expect(result.message).toBe(DOWNLOAD_FAILED_MESSAGE);
      expect(anchorClickSpy).not.toHaveBeenCalled();
    });

    it('returns status failed when document is undefined during download fallback', () => {
      Object.defineProperty(globalThis, 'document', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const success = downloadScoreCardFile(createSamplePngFile());
      expect(success).toBe(false);
    });

    it('returns false from copyShareTextToClipboard when clipboard API rejects', async () => {
      writeTextSpy.mockRejectedValue(new Error('Permission denied'));
      const success = await copyShareTextToClipboard('sample test');
      expect(success).toBe(false);
    });

    it('returns false from canShareFiles when navigator is undefined', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const capable = canShareFiles(createSamplePngFile());
      expect(capable).toBe(false);
    });
  });

  describe('DOM & Resource Cleanup', () => {
    it('appends and cleans up the temporary anchor element from the DOM', () => {
      const mockFile = createSamplePngFile();
      const success = downloadScoreCardFile(mockFile);

      expect(success).toBe(true);
      expect(appendChildSpy).toHaveBeenCalledTimes(1);
      expect(removeChildSpy).toHaveBeenCalledTimes(1);
      expect(createdAnchor.parentNode).toBeNull();
    });

    it('revokes the object URL after download completes', () => {
      const mockFile = createSamplePngFile();
      const success = downloadScoreCardFile(mockFile);

      expect(success).toBe(true);
      expect(createObjectURLSpy).toHaveBeenCalledWith(mockFile);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/mock-uuid-1234');
    });

    it('cleans up DOM anchor and revokes object URL even if anchor.click() throws', () => {
      anchorClickSpy.mockImplementation(() => {
        throw new Error('Simulated click failure');
      });

      const mockFile = createSamplePngFile();
      const success = downloadScoreCardFile(mockFile);

      expect(success).toBe(false);
      expect(removeChildSpy).toHaveBeenCalledTimes(1);
      expect(createdAnchor.parentNode).toBeNull();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/mock-uuid-1234');
    });
  });
});
