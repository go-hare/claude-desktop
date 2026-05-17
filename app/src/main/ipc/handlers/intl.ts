import { app } from 'electron';
import type { IpcRegistry } from '../registry';

let currentLocale: string | null = null;

export function registerIntlHandlers(reg: IpcRegistry) {
  reg.method('claude.hybrid', 'DesktopIntl', 'getInitialLocale', () => {
    if (!currentLocale) currentLocale = app.getLocale() || 'en-US';
    return currentLocale;
  });
  reg.method('claude.hybrid', 'DesktopIntl', 'requestLocaleChange', (locale) => {
    if (typeof locale === 'string' && locale) {
      currentLocale = locale;
      reg.broadcastEvent('claude.hybrid', 'DesktopIntl', 'localeChanged', locale);
    }
  });
}
