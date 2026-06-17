import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteProject, fetchProjects, updateProject } from "../../api/projects";
import ProjectEditor from "../../components/admin/ProjectEditor";
import PageHeader from "../../components/ui/PageHeader";
import Spinner from "../../components/ui/Spinner";
import type { Project } from "../../types";

export default function ProjectsAdmin() {
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", "all-admin"],
    queryFn: () => fetchProjects(),
  });
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const archive = useMutation({
    mutationFn: (p: Project) => updateProject(p._id, { type: "archive" }),
    onSuccess: invalidate,
  });
  const togglePublish = useMutation({
    mutationFn: (p: Project) => updateProject(p._id, { published: !p.published }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: invalidate,
  });

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Add, edit, archive, and attach files."
        action={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New project
          </button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {projects.map((p) => (
            <div key={p._id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {p.title}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                    {p.type}
                  </span>
                  {!p.published && <span className="text-xs text-amber-500">draft</span>}
                </p>
                <p className="truncate text-sm text-slate-400">{p.summary}</p>
              </div>
              <button className="btn-ghost p-2" title="Toggle publish" onClick={() => togglePublish.mutate(p)}>
                {p.published ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              {p.type !== "archive" && (
                <button className="btn-ghost p-2" title="Archive" onClick={() => archive.mutate(p)}>
                  <Archive size={16} />
                </button>
              )}
              <button className="btn-ghost p-2" title="Edit" onClick={() => setEditing(p)}>
                <Pencil size={16} />
              </button>
              <button
                className="btn-ghost p-2 text-red-500"
                title="Delete"
                onClick={() => {
                  if (confirm(`Delete "${p.title}"? This removes its files too.`)) remove.mutate(p._id);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">No projects yet.</p>
          )}
        </div>
      )}

      {creating && <ProjectEditor open project={null} onClose={() => setCreating(false)} />}
      {editing && <ProjectEditor open project={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
