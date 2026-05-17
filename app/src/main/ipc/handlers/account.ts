import { shell } from 'electron';
import type { IpcRegistry } from '../registry';

interface AccountDetails {
  apiKey?: string | null;
  uuid?: string;
  organizationUuid?: string;
  email?: string;
  [k: string]: unknown;
}

let accountDetails: AccountDetails | null = null;

export function getAccountDetails(): AccountDetails | null {
  return accountDetails;
}

export function registerAccountHandlers(reg: IpcRegistry) {
  // Account
  reg.method('claude.web', 'Account', 'setAccountDetails', (details) => {
    if (details && typeof details === 'object') {
      accountDetails = details as AccountDetails;
    } else {
      accountDetails = null;
    }
  });

  // Auth — phase 0 punts on OAuth. doAuthInBrowser opens the browser to a
  // placeholder URL, but we don't have a callback wired yet. Phase 1 will
  // implement the real OAuth dance + deep link handler.
  reg.method('claude.web', 'Auth', 'doAuthInBrowser', async (url) => {
    if (typeof url === 'string') {
      await shell.openExternal(url);
    }
  });

  // DeepLink — receives `claude://...` URLs after OS handoff. Stub for now.
  reg.method('claude.web', 'DeepLink', 'handleDeepLink', () => undefined);
}
