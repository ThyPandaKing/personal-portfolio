import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, PlayCircle, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  createProject,
  deleteProjectAsset,
  updateProject,
  uploadProjectAsset,
  type ProjectInput,
} from "../../api/projects";
import { apiErrorMessage } from "../../lib/api";
import type { Project, ProjectType } from "../../types";
import Modal from "../ui/Modal";
import ImageUploadField from "./ImageUploadField";

interface Props {
  open: boolean;
  project: Project | null; // null = create new
  onClose: () => void;
}

const blank: ProjectInput = {
  title: "",
  type: "personal",
  summary: "",
  about: "",
  impact: "",
  learning: "",
  skillsUsed: [],
  demoLink: "",
  githubLink: "",
  coverImage: "",
  featured: false,
  order: 0,
  published: true,
};

const types: ProjectType[] = ["enterprise", "personal", "archive"];

export default function ProjectEditor({ open, project, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProjectInput>(project ? { ...blank, ...project } : blank);
  const [skillsText, setSkillsText] = useState((project?.skillsUsed ?? []).join(", "));
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Project | null>(project);
  const assetRef = useRef<HTMLInputElement>(null);
  const [uploadingAsset, setUploadingAsset] = useState(false);

  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, skillsUsed: parseSkills(skillsText) };
      return current ? updateProject(current._id, payload) : createProject(payload);
    },
    onSuccess: (saved) => {
      setCurrent(saved);
      invalidate();
      if (!project) onClose(); // close after first create; keep open when editing to manage assets
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const handleAsset = async (file: File) => {
    if (!current) return;
    setUploadingAsset(true);
    try {
      const updated = await uploadProjectAsset(current._id, file);
      setCurrent(updated);
      invalidate();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setUploadingAsset(false);
    }
  };

  const removeAsset = async (assetId: string) => {
    if (!current) return;
    const updated = await deleteProjectAsset(current._id, assetId);
    setCurrent(updated);
    invalidate();
  };

  return (
    <Modal open={open} onClose={onClose} title={project ? "Edit project" : "New project"} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => set("type", e.target.value as ProjectType)}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Summary (one line)</label>
          <input className="input" value={form.summary} onChange={(e) => set("summary", e.target.value)} />
        </div>

        <ImageUploadField label="Cover image" value={form.coverImage} onChange={(url) => set("coverImage", url)} />

        {(["about", "impact", "learning"] as const).map((field) => (
          <div key={field}>
            <label className="label capitalize">{field} (markdown)</label>
            <textarea
              className="input min-h-[110px] font-mono text-sm"
              value={form[field]}
              onChange={(e) => set(field, e.target.value)}
            />
          </div>
        ))}

        <div>
          <label className="label">Skills used (comma separated)</label>
          <input className="input" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Demo link</label>
            <input className="input" value={form.demoLink} onChange={(e) => set("demoLink", e.target.value)} />
          </div>
          <div>
            <label className="label">GitHub link</label>
            <input className="input" value={form.githubLink} onChange={(e) => set("githubLink", e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} />
            Published (visible to visitors)
          </label>
          <label className="flex items-center gap-2 text-sm">
            Order
            <input
              type="number"
              className="input w-20"
              value={form.order}
              onChange={(e) => set("order", Number(e.target.value))}
            />
          </label>
        </div>

        {/* Assets — only after the project exists */}
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold">Recordings & PDFs</h4>
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={!current || uploadingAsset}
              onClick={() => assetRef.current?.click()}
              title={current ? "" : "Save the project first"}
            >
              {uploadingAsset ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />} Add file
            </button>
            <input
              ref={assetRef}
              type="file"
              accept=".pdf,video/*,audio/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleAsset(e.target.files[0])}
            />
          </div>
          {!current && <p className="text-sm text-slate-400">Save the project to attach files.</p>}
          <div className="space-y-2">
            {current?.assets.map((a) => (
              <div key={a._id} className="flex items-center gap-2 text-sm">
                {a.type === "pdf" ? <FileText size={15} /> : <PlayCircle size={15} />}
                <span className="flex-1 truncate">{a.name}</span>
                <button className="btn-ghost text-red-500" onClick={() => removeAsset(a._id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" disabled={!form.title.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
            {current ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function parseSkills(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
