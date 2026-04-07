import { formatTraceparent, generateTraceId, generateSpanId } from '../instrumentation/traceContext';

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
});
