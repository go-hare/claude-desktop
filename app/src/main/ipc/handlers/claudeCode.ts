import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IpcRegistry } from '../registry';

const execFileAsync = promisify(execFile);

let gitProbe: Promise<boolean> | null = null;

async function probeGit(): Promise<boolean> {
  if (!gitProbe) {
    gitProbe = (async () => {
      try {
        await execFileAsync('git', ['--version'], { timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    })();
  }
  return gitProbe;
}

export function registerClaudeCodeHandlers(reg: IpcRegistry) {
  reg.method('claude.web', 'ClaudeCode', 'getStatus', () => ({
    ready: true,
    // Phase 0.4 (engine adapter) will populate the real state. For now we
    // claim ready so the SPA renders the chat surface; sendMessage will
    // fail loudly when actually invoked.
    cliPath: null,
    cliVersion: null,
    error: null,
  }));
  reg.method('claude.web', 'ClaudeCode', 'prepare', async () => undefined);
  reg.method('claude.web', 'ClaudeCode', 'checkGitAvailable', () => probeGit());
  reg.method('claude.web', 'ClaudeCode', 'resolveLocalSettings', () => ({
    cwd: process.cwd(),
    model: 'claude-sonnet-4-6',
    permissionMode: 'default',
    effort: 'medium',
  }));
}
