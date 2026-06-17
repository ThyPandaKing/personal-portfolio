import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { createSkill, deleteSkill, fetchSkills, updateSkill } from "../../api/skills";
import type { Skill } from "../../types";

export default function SkillsManager() {
  const qc = useQueryClient();
  const { data: skills = [] } = useQuery({ queryKey: ["skills"], queryFn: fetchSkills });
  const [draft, setDraft] = useState({ name: "", category: "General", level: 70 });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["skills"] });

  const add = useMutation({
    mutationFn: () => createSkill({ ...draft, icon: "", order: skills.length }),
    onSuccess: () => {
      setDraft({ name: "", category: draft.category, level: 70 });
      invalidate();
    },
  });
  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Skill> }) => updateSkill(id, data),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteSkill(id), onSuccess: invalidate });

  return (
    <section className="card space-y-4 p-6">
      <h3 className="font-semibold">Skills</h3>

      {/* Add new */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="label">Name</label>
          <input
            className="input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. TypeScript"
          />
        </div>
        <div className="w-40">
          <label className="label">Category</label>
          <input
            className="input"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          />
        </div>
        <div className="w-28">
          <label className="label">Level {draft.level}%</label>
          <input
            type="range"
            min={0}
            max={100}
            value={draft.level}
            onChange={(e) => setDraft({ ...draft, level: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <button
          className="btn-primary"
          disabled={!draft.name.trim() || add.isPending}
          onClick={() => add.mutate()}
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Existing */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {skills.map((s) => (
          <div key={s._id} className="flex items-center gap-3 py-2">
            <span className="w-40 truncate font-medium">{s.name}</span>
            <input
              className="input w-36"
              value={s.category}
              onChange={(e) => patch.mutate({ id: s._id, data: { category: e.target.value } })}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={s.level}
              onChange={(e) => patch.mutate({ id: s._id, data: { level: Number(e.target.value) } })}
              className="flex-1"
            />
            <span className="w-10 text-right text-sm text-slate-400">{s.level}%</span>
            <button className="btn-ghost text-red-500" onClick={() => remove.mutate(s._id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {skills.length === 0 && (
          <p className="py-2 text-sm text-slate-400">No skills yet. Add your first above.</p>
        )}
      </div>
    </section>
  );
}
