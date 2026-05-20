import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMemo } from 'react';
import { Check, Circle, Loader2 } from 'lucide-react';

type ToolCall = {
  id: string;
  name: string;
  input?: any;
};

type Todo = {
  content: string;
  activeForm?: string;
  status: 'pending' | 'in_progress' | 'completed';
};

function findLatestTodos(toolCalls: ToolCall[]): Todo[] | null {
  for (let i = toolCalls.length - 1; i >= 0; i -= 1) {
    const tool = toolCalls[i];
    if (tool.name !== 'TodoWrite') continue;
    const todos = tool.input && typeof tool.input === 'object' ? tool.input.todos : null;
    if (!Array.isArray(todos) || !todos.length) continue;
    return todos.filter((todo: any) => todo && typeof todo.content === 'string') as Todo[];
  }
  return null;
}

function findLatestPlanMarkdown(toolCalls: ToolCall[]): string | null {
  for (let i = toolCalls.length - 1; i >= 0; i -= 1) {
    const tool = toolCalls[i];
    if (tool.name !== 'ExitPlanMode') continue;
    const plan = tool.input && typeof tool.input === 'object' ? tool.input.plan : null;
    if (typeof plan === 'string' && plan.trim()) return plan;
  }
  return null;
}

function TodoIcon({ status }: { status: Todo['status'] }) {
  if (status === 'completed') return <Check size={14} strokeWidth={2.4} className="text-extended-green" />;
  if (status === 'in_progress') return <Loader2 size={14} strokeWidth={1.8} className="animate-spin text-[var(--dot-ready)]" />;
  return <Circle size={14} strokeWidth={1.6} className="text-t5" />;
}

export default function CodePlanPane({ toolCalls }: { toolCalls: ToolCall[] }) {
  const todos = useMemo(() => findLatestTodos(toolCalls), [toolCalls]);
  const planMarkdown = useMemo(() => (todos ? null : findLatestPlanMarkdown(toolCalls)), [toolCalls, todos]);

  if (todos && todos.length) {
    const completed = todos.filter((todo) => todo.status === 'completed').length;
    return (
      <div className="flex flex-col gap-g5 p-p6 text-body text-t8">
        <div className="text-footnote text-t6">{completed} / {todos.length} completed</div>
        <ul role="list" className="flex flex-col gap-g3">
          {todos.map((todo, idx) => {
            const label = todo.status === 'in_progress' && todo.activeForm ? todo.activeForm : todo.content;
            return (
              <li
                key={`${idx}-${todo.content}`}
                className={'flex items-start gap-g4 rounded-r5 px-p3 py-[6px] ' + (todo.status === 'in_progress' ? 'bg-t1' : '')}
              >
                <span className="mt-[2px] inline-flex h-[16px] w-[16px] items-center justify-center">
                  <TodoIcon status={todo.status} />
                </span>
                <span className={'min-w-0 flex-1 whitespace-pre-wrap break-words ' + (todo.status === 'completed' ? 'text-t6 line-through' : 'text-t8')}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (planMarkdown) {
    return (
      <div className="epitaxy-markdown p-p6 text-body text-t8">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{planMarkdown}</ReactMarkdown>
      </div>
    );
  }

  return <div className="flex h-full items-center justify-center text-center text-t5">No plan yet.</div>;
}

