import {
  formatTraceparent,
  generateTraceId,
  generateSpanId,
} from '../instrumentation/traceContext';

describe('traceContext', () => {
  it('generates 32-char hex trace ID', () => {
    const id = generateTraceId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates 16-char hex span ID', () => {
    const id = generateSpanId();
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('formats traceparent with sampled flag', () => {
    const header = formatTraceparent('a'.repeat(32), 'b'.repeat(16), true);
    expect(header).toBe(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`);
  });

  it('formats traceparent with unsampled flag', () => {
    const header = formatTraceparent('a'.repeat(32), 'b'.repeat(16), false);
    expect(header).toBe(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-00`);
  });

  describe('crypto entropy', () => {
    it('uses global.crypto.getRandomValues when available', () => {
      const fillSpy = jest.spyOn(global.crypto, 'getRandomValues').mockImplementation((buf) => {
        if (buf instanceof Uint8Array) {
          buf.fill(0xab);
        }
        return buf;
      });

      const id = generateTraceId();
      expect(id).toMatch(/^[0-9a-f]{32}$/);
      expect(fillSpy).toHaveBeenCalled();
      fillSpy.mockRestore();
    });

    it('falls back to Math.random and warns once when crypto unavailable', () => {
      const originalCrypto = global.crypto;
      // @ts-expect-error intentional override for test
      global.crypto = undefined;

      jest.resetModules();
      const { generateTraceId: freshGenerateTraceId, generateSpanId: freshGenerateSpanId } =
        require('../instrumentation/traceContext') as typeof import('../instrumentation/traceContext');

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const id1 = freshGenerateTraceId();
      const id2 = freshGenerateSpanId();
      const id3 = freshGenerateTraceId();

      expect(id1).toMatch(/^[0-9a-f]{32}$/);
      expect(id2).toMatch(/^[0-9a-f]{16}$/);
      expect(id3).toMatch(/^[0-9a-f]{32}$/);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        '[EDOT] crypto.getRandomValues not available, falling back to Math.random() — trace IDs may collide',
      );

      warnSpy.mockRestore();
      global.crypto = originalCrypto;
    });
  });
});
