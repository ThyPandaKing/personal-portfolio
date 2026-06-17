import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { createBlog, updateBlog, type BlogInput } from "../../api/blogs";
import { apiErrorMessage } from "../../lib/api";
import type { Blog } from "../../types";
import Modal from "../ui/Modal";
import ImageUploadField from "./ImageUploadField";

interface Props {
  open: boolean;
  blog: Blog | null;
  onClose: () => void;
}

const blank: BlogInput = {
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  tags: [],
  published: false,
};

export default function BlogEditor({ open, blog, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<BlogInput>(blog ? { ...blank, ...blog } : blank);
  const [tagsText, setTagsText] = useState((blog?.tags ?? []).join(", "));
  const [error, setError] = useState("");

  const set = <K extends keyof BlogInput>(k: K, v: BlogInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      };
      return blog ? updateBlog(blog._id, payload) : createBlog(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blogs"] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title={blog ? "Edit article" : "New article"} wide>
      <div className="space-y-4">
        <div>
          <label className="label">Title</label>
          <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <label className="label">Excerpt</label>
          <input className="input" value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
        </div>
        <ImageUploadField label="Cover image" value={form.coverImage} onChange={(url) => set("coverImage", url)} />
        <div>
          <label className="label">Content (markdown)</label>
          <textarea
            className="input min-h-[280px] font-mono text-sm"
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Tags (comma separated)</label>
          <input className="input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} />
          Published
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!form.title.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
            {blog ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
