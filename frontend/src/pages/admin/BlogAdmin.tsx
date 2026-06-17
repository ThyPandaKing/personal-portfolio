import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteBlog, fetchBlogs, updateBlog } from "../../api/blogs";
import BlogEditor from "../../components/admin/BlogEditor";
import PageHeader from "../../components/ui/PageHeader";
import Spinner from "../../components/ui/Spinner";
import type { Blog } from "../../types";

export default function BlogAdmin() {
  const qc = useQueryClient();
  const { data: blogs = [], isLoading } = useQuery({ queryKey: ["blogs"], queryFn: () => fetchBlogs() });
  const [editing, setEditing] = useState<Blog | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["blogs"] });
  const togglePublish = useMutation({
    mutationFn: (b: Blog) => updateBlog(b._id, { published: !b.published }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteBlog(id), onSuccess: invalidate });

  return (
    <div>
      <PageHeader
        title="Blog"
        subtitle="Write, edit, and publish articles."
        action={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New article
          </button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {blogs.map((b) => (
            <div key={b._id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {b.title}
                  {!b.published && <span className="text-xs text-amber-500">draft</span>}
                </p>
                <p className="truncate text-sm text-slate-400">{b.excerpt}</p>
              </div>
              <button className="btn-ghost p-2" title="Toggle publish" onClick={() => togglePublish.mutate(b)}>
                {b.published ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button className="btn-ghost p-2" title="Edit" onClick={() => setEditing(b)}>
                <Pencil size={16} />
              </button>
              <button
                className="btn-ghost p-2 text-red-500"
                title="Delete"
                onClick={() => {
                  if (confirm(`Delete "${b.title}"?`)) remove.mutate(b._id);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {blogs.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No articles yet.</p>}
        </div>
      )}

      {creating && <BlogEditor open blog={null} onClose={() => setCreating(false)} />}
      {editing && <BlogEditor open blog={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
