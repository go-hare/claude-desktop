import type { IpcRegistry } from '../registry';
import { ClaudeCodeAdapter } from '../../engine/claudeCodeAdapter';
import { registerSettingsHandlers } from './settings';
import { registerWindowHandlers } from './window';
import { registerIntlHandlers } from './intl';
import { registerAccountHandlers } from './account';
import { registerNotificationsHandlers } from './notifications';
import { registerClaudeCodeHandlers } from './claudeCode';
import { registerLocalSessionsHandlers } from './localSessions';
import { registerLocalAgentModeHandlers } from './localAgentMode';
import { registerSkillsHandlers } from './skills';
import { registerFilesystemHandlers } from './filesystem';
import { registerAutoUpdaterHandlers } from './autoUpdater';
import { registerLaunchHandlers } from './launch';
import { registerCCDScheduledTasksHandlers } from './ccdScheduledTasks';

export function registerAllHandlers(reg: IpcRegistry) {
  // One adapter instance per app run. Hands raw SDKMessage events to the
  // SPA via the registry's event broadcaster — every renderer window with
  // the active session subscribed via `LocalSessions.onEvent` receives them.
  const engine = new ClaudeCodeAdapter((sessionId, message) => {
    reg.broadcastEvent('claude.web', 'LocalSessions', 'onEvent', {
      sessionId,
      message,
    });
  });

  registerSettingsHandlers(reg);
  registerWindowHandlers(reg);
  registerIntlHandlers(reg);
  registerAccountHandlers(reg);
  registerNotificationsHandlers(reg);
  registerClaudeCodeHandlers(reg);
  registerLocalSessionsHandlers(reg, engine);
  registerLocalAgentModeHandlers(reg);
  registerSkillsHandlers(reg);
  registerFilesystemHandlers(reg);
  registerAutoUpdaterHandlers(reg);
  registerLaunchHandlers(reg);
  registerCCDScheduledTasksHandlers(reg);
}
