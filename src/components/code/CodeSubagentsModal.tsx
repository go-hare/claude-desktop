import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { deleteSubagent, getSubagents, saveSubagent, type SubagentDef } from '../../api';
import { pushError, pushSuccess } from './codeToastStore';

type Props = {
  open: boolean;
  cwd?: string | null;
  onClose: () => void;
};

type Agents = { user: Record<string, SubagentDef>; project: Record<string, SubagentDef> };

export default function CodeSubagentsModal({ open, cwd, onClose }: Props) {
  const [agents, setAgents] = useState<Agents>({ user: {}, project: {} });
  const [selected, setSelected] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDef, setEditDef] = useState<SubagentDef>({ description: '', prompt: '', model: '', tools: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    getSubagents(cwd || null).then(setAgents).catch(() => {});
  }, [open, cwd]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const userNames = Object.keys(agents.user).sort();
  const projectNames = Object.keys(agents.project).sort();

  const startEdit = (name: string) => {
    const def = agents.user[name];
    if (!def) return;
    setIsCreating(false);
    setSelected(name);
    setEditName(name);
    setEditDef({
      description: def.description || '',
      prompt: def.prompt || '',
      model: def.model || '',
      tools: Array.isArray(def.tools) ? def.tools : [],
    });
  };

  const startCreate = () => {
    setIsCreating(true);
    setSelected(null);
    setEditName('');
    setEditDef({ description: '', prompt: '', model: '', tools: [] });
  };

  const save = async () => {
    if (!editName.trim()) { pushError('Name 不能为空'); return; }
    if (!/^[a-z0-9_-]+$/i.test(editName)) { pushError('Name 只能是字母/数字/下划线/横线'); return; }
    if (!editDef.description.trim()) { pushError('Description 必填'); return; }
    if (!editDef.prompt.trim()) { pushError('System prompt 必填'); return; }
    setBusy(true);
    try {
      const cleaned: SubagentDef = {
        description: editDef.description.trim(),
        prompt: editDef.prompt,
      };
      if (editDef.model && editDef.model.trim()) cleaned.model = editDef.model.trim();
      if (editDef.tools && editDef.tools.length) cleaned.tools = editDef.tools;
      const res = await saveSubagent(editName, cleaned);
      if (!res.ok) { pushError(res.error || '保存失败'); return; }
      pushSuccess(`已保存 ${editName}`);
      const next = await getSubagents(cwd || null);
      setAgents(next);
      setSelected(editName);
      setIsCreating(false);
    } finally { setBusy(false); }
  };

  const remove = async (name: string) => {
    if (!window.confirm(`删除 subagent "${name}"？`)) return;
    setBusy(true);
    try {
      await deleteSubagent(name);
      const next = await getSubagents(cwd || null);
      setAgents(next);
      if (selected === name) { setSelected(null); setIsCreating(false); }
      pushSuccess(`已删除 ${name}`);
    } finally { setBusy(false); }
  };

  const editing = isCreating || selected !== null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Subagents"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30"
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <div className="w-[860px] max-w-[94vw] h-[600px] max-h-[88vh] flex flex-col rounded-[14px] border border-t2 bg-[var(--surface-popover)] shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between gap-g4 px-p6 py-p5 border-b border-t3">
          <h2 className="m-0 text-heading text-t9">Subagents</h2>
          <button onClick={onClose} aria-label="Close" className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-r5 text-t6 hover:bg-t2 hover:text-t8">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 flex">
          <aside className="w-[260px] shrink-0 border-r border-t3 flex flex-col">
            <div className="px-p5 pt-p4 pb-g3 flex items-center justify-between">
              <span className="text-footnote text-t6 uppercase tracking-wide">User</span>
              <button onClick={startCreate} className="inline-flex items-center gap-g2 text-footnote text-t6 hover:text-t8" title="新建">
                <Plus size={12} /> 新建
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-p4">
              {userNames.length === 0 ? (
                <div className="px-p5 py-p4 text-footnote text-t5">暂无。</div>
              ) : userNames.map((name) => (
                <button
                  key={name}
                  onClick={() => startEdit(name)}
                  className={'flex w-full items-center justify-between gap-g3 px-p5 py-p3 text-left ' + (selected === name && !isCreating ? 'bg-t2' : 'hover:bg-t2')}
                >
                  <span className="min-w-0 flex-1 truncate text-body text-t8">{name}</span>
                  <span
                    role="button"
                    aria-label={`Delete ${name}`}
                    onClick={(event) => { event.stopPropagation(); remove(name); }}
                    className="text-t5 hover:text-extended-pink"
                  >
                    <Trash2 size={12} />
                  </span>
                </button>
              ))}

              {projectNames.length > 0 ? (
                <>
                  <div className="px-p5 pt-p4 pb-g3 text-footnote text-t6 uppercase tracking-wide">Project (read-only)</div>
                  {projectNames.map((name) => (
                    <div key={name} className="px-p5 py-p3 text-body text-t6">
                      {name}
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          </aside>
          <main className="min-w-0 flex-1 overflow-y-auto p-p6">
            {!editing ? (
              <div className="h-full flex items-center justify-center text-body text-t5">选一个 subagent 查看，或点「新建」。</div>
            ) : (
              <div className="flex flex-col gap-g5">
                <Field label="Name">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={!isCreating}
                    placeholder="my-reviewer"
                    className="h-[28px] w-full rounded-r5 border border-t3 bg-z0 px-p4 text-body text-t8 disabled:opacity-60"
                  />
                </Field>
                <Field label="Description">
                  <input
                    value={editDef.description}
                    onChange={(e) => setEditDef((d) => ({ ...d, description: e.target.value }))}
                    placeholder="Reviews code for bugs"
                    className="h-[28px] w-full rounded-r5 border border-t3 bg-z0 px-p4 text-body text-t8"
                  />
                </Field>
                <Field label="Model" hint="留空走默认。例如 claude-sonnet-4-6 / claude-haiku-4-5-20251001">
                  <input
                    value={editDef.model || ''}
                    onChange={(e) => setEditDef((d) => ({ ...d, model: e.target.value }))}
                    placeholder="(default)"
                    className="h-[28px] w-full rounded-r5 border border-t3 bg-z0 px-p4 text-body text-t8"
                  />
                </Field>
                <Field label="Tools" hint="留空 = 全部工具。逗号分隔，如 Read, Grep, Bash">
                  <input
                    value={(editDef.tools || []).join(', ')}
                    onChange={(e) => setEditDef((d) => ({ ...d, tools: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
                    placeholder="(all tools)"
                    className="h-[28px] w-full rounded-r5 border border-t3 bg-z0 px-p4 text-body text-t8"
                  />
                </Field>
                <Field label="System prompt">
                  <textarea
                    value={editDef.prompt}
                    onChange={(e) => setEditDef((d) => ({ ...d, prompt: e.target.value }))}
                    rows={10}
                    placeholder="You are a code reviewer..."
                    className="w-full rounded-r5 border border-t3 bg-z0 px-p4 py-p3 text-body text-t8 font-mono leading-[1.55]"
                  />
                </Field>
                <div className="flex gap-g4">
                  <button onClick={save} disabled={busy} className="inline-flex h-[28px] items-center rounded-r5 bg-t9 px-p5 text-body text-z0 hover:bg-t8 disabled:opacity-50">
                    {busy ? '保存中…' : '保存'}
                  </button>
                  {!isCreating && selected ? (
                    <button onClick={() => remove(selected)} disabled={busy} className="inline-flex h-[28px] items-center rounded-r5 px-p5 text-body text-extended-pink hover:bg-t2 disabled:opacity-50">
                      删除
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-g2">
      <label className="text-footnote text-t6">{label}</label>
      {children}
      {hint ? <span className="text-footnote text-t5">{hint}</span> : null}
    </div>
  );
}
