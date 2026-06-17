import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Sparkles, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { fetchProjects } from "../../api/projects";
import { generateResume } from "../../api/resumes";
import { fetchSkills } from "../../api/skills";
import { apiErrorMessage } from "../../lib/api";
import { printResume } from "../../lib/print";
import type { ResumeRole } from "../../types";
import Markdown from "../ui/Markdown";

const roles: ResumeRole[] = ["SDE", "AI", "other"];

export default function ResumeGenerator() {
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ["projects", "all-admin"], queryFn: () => fetchProjects() });
  const { data: skills = [] } = useQuery({ queryKey: ["skills"], queryFn: fetchSkills });

  const [title, setTitle] = useState("AI-generated resume");
  const [role, setRole] = useState<ResumeRole>("SDE");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [preview, setPreview] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const generate = useMutation({
    mutationFn: () => generateResume({ title, role, projectIds, skills: selectedSkills, instructions }),
    onSuccess: (resume) => {
      setPreview(resume.content);
      setError("");
      qc.invalidateQueries({ queryKey: ["resumes"] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <section className="card mt-8 space-y-5 p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="text-brand-600" />
        <h3 className="text-lg font-bold">AI Resume Generator</h3>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Pick projects and skills, add instructions, and Gemini will draft a tailored resume. It’s saved as a
        draft (not public) so you can review and publish it above.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Target role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as ResumeRole)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Projects to include</label>
        <div className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
          {projects.map((p) => (
            <label key={p._id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={projectIds.includes(p._id)}
                onChange={() => setProjectIds((a) => toggle(a, p._id))}
              />
              {p.title}
            </label>
          ))}
          {projects.length === 0 && <p className="text-sm text-slate-400">No projects yet.</p>}
        </div>
      </div>

      <div>
        <label className="label">Skills to emphasize</label>
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <button
              key={s._id}
              type="button"
              onClick={() => setSelectedSkills((a) => toggle(a, s.name))}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedSkills.includes(s.name)
                  ? "bg-accent text-accent-contrast"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {s.name}
            </button>
          ))}
          {skills.length === 0 && <p className="text-sm text-slate-400">No skills yet.</p>}
        </div>
      </div>

      <div>
        <label className="label">Additional instructions</label>
        <textarea
          className="input min-h-[90px]"
          placeholder="e.g. Emphasize distributed systems; keep to one page; formal tone."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button className="btn-primary" disabled={generate.isPending} onClick={() => generate.mutate()}>
        {generate.isPending ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
        Generate resume
      </button>

      {preview && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-semibold">Preview (saved as draft above)</h4>
            <button
              onClick={() => previewRef.current && printResume(title, previewRef.current.innerHTML)}
              className="btn-ghost text-sm"
            >
              <Download size={15} /> Download PDF
            </button>
          </div>
          <div ref={previewRef} className="card max-h-[60vh] overflow-y-auto p-6">
            <Markdown>{preview}</Markdown>
          </div>
        </div>
      )}
    </section>
  );
}
