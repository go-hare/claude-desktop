import type { IpcRegistry } from '../registry';

export function registerSkillsHandlers(reg: IpcRegistry) {
  reg.method('claude.skills', 'Skills', 'previewSkillFile', () => null);
}
