export type CodeSlashCommand = {
  name: string;
  description: string;
  source?: 'builtin' | 'project' | 'user' | 'bundled';
  body?: string;
};

export const BUILTIN_SLASH_COMMANDS: CodeSlashCommand[] = [
  { name: 'clear', description: 'Clear the visible transcript (does not affect history).', source: 'builtin' },
  { name: 'compact', description: 'Ask the engine to summarise older context.', source: 'builtin' },
  { name: 'cwd', description: 'Show the working directory of this session.', source: 'builtin' },
  { name: 'help', description: 'List available slash commands.', source: 'builtin' },
];

export function detectSlashQuery(text: string, caretIndex: number): string | null {
  if (caretIndex < 0 || caretIndex > text.length) return null;
  const before = text.slice(0, caretIndex);
  const lastNewline = before.lastIndexOf('\n');
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const slashIndex = before.indexOf('/', lineStart);
  if (slashIndex === -1) return null;
  if (slashIndex !== lineStart && before[slashIndex - 1] !== ' ' && before[slashIndex - 1] !== '\t') {
    return null;
  }
  const fragment = before.slice(slashIndex + 1);
  if (/[\s]/.test(fragment)) return null;
  return fragment;
}

export function matchSlashCommands(query: string, commands: CodeSlashCommand[] = BUILTIN_SLASH_COMMANDS): CodeSlashCommand[] {
  const normalized = query.toLowerCase();
  return commands.filter((command) => command.name.toLowerCase().startsWith(normalized));
}
