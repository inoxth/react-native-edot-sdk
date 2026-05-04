import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../..');
const FORBIDDEN = [
  "'view\\.name'",
  "'view\\.previous'",
  "'view\\.transition_type'",
  "'view\\.id'",
  "'view\\.url'",
  '"view\\.name"',
  '"view\\.previous"',
  '"view\\.transition_type"',
  '"view\\.id"',
  '"view\\.url"',
];

describe('legacy view.* attribute regression guard', () => {
  it('does not contain view.* string literals in non-test source code', () => {
    const pattern = FORBIDDEN.join('|');
    const cmd =
      `git -C ${JSON.stringify(REPO_ROOT)} grep -lE ${JSON.stringify(pattern)} -- ` +
      `'packages/*/src/'`;

    let raw: string;
    try {
      raw = execSync(cmd, { encoding: 'utf8' });
    } catch (err) {
      const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
      const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
      if (stdout.trim() === '' && stderr.trim() === '') {
        // git grep exits 1 when nothing matches — expected
        return;
      }
      throw new Error(`Guard execution failed: ${stderr || stdout}`);
    }

    const offending = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.includes('__tests__'))
      .filter((line) => !line.endsWith('lib/typescript/index.d.ts'));

    if (offending.length > 0) {
      throw new Error(
        `Found legacy view.* string literals in package sources:\n${offending.join('\n')}\n\n` +
          `Use screen.name / last.screen.name / screen.id instead. ` +
          `view.transition_type and view.url have no replacement.`,
      );
    }
  });
});
