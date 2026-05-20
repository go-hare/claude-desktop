export function summarizeToolInput(toolName: string, input: any): string {
  if (!input || typeof input !== 'object') return '';
  if (toolName === 'Bash' && typeof input.command === 'string') return input.command;
  if (toolName === 'Edit' && typeof input.file_path === 'string') return input.file_path;
  if (toolName === 'Write' && typeof input.file_path === 'string') return input.file_path;
  if (toolName === 'Read' && typeof input.file_path === 'string') return input.file_path;
  if (toolName === 'NotebookEdit' && typeof input.notebook_path === 'string') return input.notebook_path;
  if (toolName === 'Glob' && typeof input.pattern === 'string') return input.pattern;
  if (toolName === 'Grep' && typeof input.pattern === 'string') return input.pattern;
  if (toolName === 'WebFetch' && typeof input.url === 'string') return input.url;
  if (toolName === 'WebSearch' && typeof input.query === 'string') return input.query;
  if (toolName === 'TodoWrite' && Array.isArray(input.todos)) {
    const inProgress = input.todos.find((todo: any) => todo && todo.status === 'in_progress');
    if (inProgress && typeof inProgress.activeForm === 'string') return inProgress.activeForm;
    return `${input.todos.length} item${input.todos.length === 1 ? '' : 's'}`;
  }
  if (toolName === 'ExitPlanMode' && typeof input.plan === 'string') {
    const firstLine = input.plan.split('\n').find((line: string) => line.trim());
    return firstLine ? firstLine.slice(0, 80) : '';
  }
  if (toolName === 'Task' && typeof input.description === 'string') return input.description;
  return '';
}
