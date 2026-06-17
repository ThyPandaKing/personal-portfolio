import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  createResume,
  deleteResume,
  fetchResumes,
  updateResume,
  uploadResumeFile,
} from "../../api/resumes";
import ResumeGenerator from "../../components/admin/ResumeGenerator";
import PageHeader from "../../components/ui/PageHeader";
import Spinner from "../../components/ui/Spinner";
import { apiErrorMessage } from "../../lib/api";
import type { Resume, ResumeRole } from "../../types";

const roles: ResumeRole[] = ["SDE", "AI", "other"];

export default function ResumesAdmin() {
  const qc = useQueryClient();
  const { data: resumes = [], isLoading } = useQuery({ queryKey: ["resumes"], queryFn: fetchResumes });
  const [newTitle, setNewTitle] = useState("");
  const [newRole, setNewRole] = useState<ResumeRole>("SDE");
  const [error, setError] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: ["resumes"] });

  const add = useMutation({
    mutationFn: () => createResume({ title: newTitle, role: newRole }),
    onSuccess: () => {
      setNewTitle("");
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Resume> }) => updateResume(id, data),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteResume(id), onSuccess: invalidate });
  const uploadFile = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadResumeFile(id, file),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader title="Resumes" subtitle="Upload PDFs and choose which are public." />

      {/* Add new */}
      <div className="card mb-6 flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1">
          <label className="label">Title</label>
          <input
            className="input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Backend SDE Resume"
          />
        </div>
        <div className="w-40">
          <label className="label">Role</label>
          <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as ResumeRole)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" disabled={!newTitle.trim() || add.isPending} onClick={() => add.mutate()}>
          <Plus size={16} /> Add
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {resumes.map((r) => (
            <div key={r._id} className="flex flex-wrap items-center gap-3 p-4">
              <FileText size={18} className="text-brand-600" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-slate-400">
                  {r.role} · {r.source}
                  {r.fileUrl ? " · PDF attached" : r.content ? " · generated" : " · empty"}
                </p>
              </div>

              <select
                className="input w-28"
                value={r.role}
                onChange={(e) => patch.mutate({ id: r._id, data: { role: e.target.value as ResumeRole } })}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              <button
                className="btn-ghost text-sm"
                title="Upload PDF"
                onClick={() => fileRefs.current[r._id]?.click()}
              >
                {uploadFile.isPending && uploadFile.variables?.id === r._id ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Upload size={16} />
                )}
              </button>
              <input
                ref={(el) => {
                  fileRefs.current[r._id] = el;
                }}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => e.target.files?.[0] && uploadFile.mutate({ id: r._id, file: e.target.files[0] })}
              />

              <button
                className="btn-ghost p-2"
                title={r.isPublic ? "Public — click to hide" : "Hidden — click to make public"}
                onClick={() => patch.mutate({ id: r._id, data: { isPublic: !r.isPublic } })}
              >
                {r.isPublic ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} />}
              </button>

              <button
                className="btn-ghost p-2 text-red-500"
                onClick={() => {
                  if (confirm(`Delete "${r.title}"?`)) remove.mutate(r._id);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {resumes.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No resumes yet.</p>}
        </div>
      )}

      <ResumeGenerator />
    </div>
  );
}
