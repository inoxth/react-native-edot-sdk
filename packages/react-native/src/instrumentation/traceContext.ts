export function generateTraceId(): string {
  return randomHex(32);
}

export function generateSpanId(): string {
  return randomHex(16);
}

export function formatTraceparent(traceId: string, spanId: string, sampled = true): string {
  const flags = sampled ? '01' : '00';
  return `00-${traceId}-${spanId}-${flags}`;
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
