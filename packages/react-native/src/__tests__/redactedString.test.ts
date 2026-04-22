import { redactedString } from '@inox/react-native-edot-shared';

describe('redactedString', () => {
  const SECRET = 's3cr3t-t0k3n';

  it('toString() returns [REDACTED]', () => {
    expect(redactedString(SECRET).toString()).toBe('[REDACTED]');
  });

  it('toJSON() returns [REDACTED]', () => {
    expect(redactedString(SECRET).toJSON()).toBe('[REDACTED]');
  });

  it('template literal returns [REDACTED]', () => {
    const token = redactedString(SECRET);
    expect(`${token}`).toBe('[REDACTED]');
  });

  it('JSON.stringify does not leak the value', () => {
    const token = redactedString(SECRET);
    const serialized = JSON.stringify({ token });
    expect(serialized).not.toContain(SECRET);
    expect(serialized).toBe('{"token":"[REDACTED]"}');
  });

  it('spread returns no enumerable properties that leak the value', () => {
    const token = redactedString(SECRET);
    const spread = { ...token };
    expect(Object.keys(spread)).toHaveLength(0);
    expect(JSON.stringify(spread)).not.toContain(SECRET);
  });

  it('reveal() returns the original string', () => {
    expect(redactedString(SECRET).reveal()).toBe(SECRET);
  });
});
