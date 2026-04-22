export interface RedactedString {
  reveal(): string;
  toString(): string;
  toJSON(): string;
}

export function redactedString(value: string): RedactedString {
  const obj: RedactedString = Object.create(null) as RedactedString;

  Object.defineProperties(obj, {
    reveal: {
      value: (): string => value,
      enumerable: false,
      writable: false,
      configurable: false,
    },
    toString: {
      value: (): string => '[REDACTED]',
      enumerable: false,
      writable: false,
      configurable: false,
    },
    toJSON: {
      value: (): string => '[REDACTED]',
      enumerable: false,
      writable: false,
      configurable: false,
    },
  });

  return obj;
}
