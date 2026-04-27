import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execAsync = promisify(exec);

/**
 * Runs `git diff HEAD` for the given absolute file path and returns the
 * unified diff. Returns an empty string if there are no uncommitted
 * changes for the file.
 *
 * Throws if the file is not inside a git repository, or if `git` is not
 * available on PATH.
 */
export async function getDiff(absoluteFilePath: string): Promise<string> {
  const cwd = path.dirname(absoluteFilePath);
  const fileName = path.basename(absoluteFilePath);

  try {
    const { stdout } = await execAsync(
      `git diff --no-color HEAD -- "${fileName}"`,
      { cwd, maxBuffer: 5 * 1024 * 1024 }
    );
    return stdout;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not a git repository/i.test(message)) {
      throw new Error('This file is not inside a git repository.');
    }
    if (/command not found|ENOENT/i.test(message)) {
      throw new Error('`git` was not found on PATH.');
    }
    throw new Error(`git diff failed: ${message}`);
  }
}
