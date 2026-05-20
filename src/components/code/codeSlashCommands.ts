export type CodeSlashCommand = {
  name: string;
  description: string;
};

export const CODE_SLASH_COMMANDS: CodeSlashCommand[] = [
  { name: 'clear', description: 'Clear the visible transcript (does not affect history).' },
  { name: 'compact', description: 'Ask the engine to summarise older context.' },
  { name: 'cwd', description: 'Show the working directory of this session.' },
  { name: 'help', description: 'List available slash commands.' },
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

export function matchSlashCommands(query: string): CodeSlashCommand[] {
  const normalized = query.toLowerCase();
  return CODE_SLASH_COMMANDS.filter((command) => command.name.startsWith(normalized));
}
