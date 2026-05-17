/**
 * CCDScheduledTasks — Claude Code Desktop scheduled tasks. Phase-0 stubs:
 * the SPA queries these to populate the "定时任务" sidebar item and the
 * scheduled-task management UI. Returning empty arrays / no-op writes is
 * enough for the surface to render; real persistence comes later.
 */

import type { IpcRegistry } from '../registry';

export function registerCCDScheduledTasksHandlers(reg: IpcRegistry) {
  reg.method('claude.web', 'CCDScheduledTasks', 'getAllScheduledTasks', () => []);
  reg.method('claude.web', 'CCDScheduledTasks', 'getScheduledTaskFileContent', () => '');
  reg.method('claude.web', 'CCDScheduledTasks', 'createScheduledTask', () => ({
    taskId: '',
  }));
  reg.method('claude.web', 'CCDScheduledTasks', 'updateScheduledTask', () => undefined);
  reg.method('claude.web', 'CCDScheduledTasks', 'updateScheduledTaskFileContent', () => undefined);
  reg.method('claude.web', 'CCDScheduledTasks', 'updateScheduledTaskStatus', () => undefined);
  reg.method('claude.web', 'CCDScheduledTasks', 'removeApprovedPermission', () => undefined);
}
