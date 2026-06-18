import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { createBlog, type BlogInput } from "../../api/blogs";
import ImageUploadField from "../../components/admin/ImageUploadField";
import PageHeader from "../../components/ui/PageHeader";
import { apiErrorMessage } from "../../lib/api";

const blank: BlogInput = {
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  tags: [],
  published: false,
};

export default function VisitorBlogForm() {
  const [form, setForm] = useState<BlogInput>(blank);
  const [tagsText, setTagsText] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = <K extends keyof BlogInput>(k: K, v: BlogInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      createBlog({
        ...form,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      setDone(true);
      setForm(blank);
      setTagsText("");
      setError("");
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (done) {
    return (
      <div>
        <PageHeader title="Write a Blog" subtitle="Share an article." />
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <CheckCircle2 className="text-green-500" size={40} />
          <h3 className="text-lg font-semibold">Submitted for review</h3>
          <p className="max-w-md text-sm text-slate-400">
            Thanks! Your article was saved as a draft. An admin will review it before it goes live.
          </p>
          <button className="btn-primary mt-2" onClick={() => setDone(false)}>
            Write another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Write a Blog"
        subtitle="Your article is submitted as a draft for an admin to review and publish."
      />

      <div className="card space-y-4 p-6">
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Excerpt</label>
          <input
            className="input"
            value={form.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
          />
        </div>
        <ImageUploadField
          label="Cover image"
          value={form.coverImage}
          onChange={(url) => set("coverImage", url)}
        />
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

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end pt-2">
          <button
            className="btn-primary"
            disabled={!form.title.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
            Submit for review
          </button>
        </div>
      </div>
    </div>
  );
}
