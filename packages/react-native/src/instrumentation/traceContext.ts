export function generateTraceId(): string {
  return randomHex(16);
}

export function generateSpanId(): string {
  return randomHex(8);
}

export function formatTraceparent(traceId: string, spanId: string, sampled = true): string {
  const flags = sampled ? '01' : '00';
  return `00-${traceId}-${spanId}-${flags}`;
}

interface CryptoLike {
  getRandomValues(buffer: Uint8Array): void;
}

interface WithCrypto {
  crypto: CryptoLike;
}

function hasCrypto(obj: object): obj is WithCrypto {
  return 'crypto' in obj && obj['crypto' as keyof typeof obj] != null;
}

let cryptoWarnEmitted = false;

function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);

  if (hasCrypto(global) && typeof global.crypto.getRandomValues === 'function') {
    global.crypto.getRandomValues(bytes);
  } else {
    if (!cryptoWarnEmitted) {
      cryptoWarnEmitted = true;
      console.warn(
        '[EDOT] crypto.getRandomValues not available, falling back to Math.random() — trace IDs may collide',
      );
    }
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
