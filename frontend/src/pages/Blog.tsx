import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Clock, Search, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { fetchBlogs } from "../api/blogs";
import PageHeader from "../components/ui/PageHeader";
import Spinner from "../components/ui/Spinner";

export default function Blog() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");

  const { data: blogs = [], isLoading } = useQuery({
    queryKey: ["blogs", q, tag],
    queryFn: () => fetchBlogs({ q: q || undefined, tag: tag || undefined }),
  });

  // Tags available to pick from (from current results + the active one).
  const tags = Array.from(new Set([...blogs.flatMap((b) => b.tags ?? []), tag].filter(Boolean)));

  return (
    <div className="container-page py-12">
      <PageHeader title="Blog" subtitle="Notes, write-ups, and things I’ve learned." />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search articles…"
            className="input w-64 py-1.5 pl-9 text-sm"
          />
        </div>
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => setTag(tag === t ? "" : t)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition ${
              tag === t
                ? "bg-accent text-accent-contrast"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            #{t} {tag === t && <X size={13} />}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : blogs.length === 0 ? (
        <p className="py-16 text-center text-slate-400">No articles match these filters.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {blogs.map((b) => (
            <motion.div
              key={b._id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <Link to={`/blog/${b.slug}`} className="card group flex h-full flex-col overflow-hidden">
                {b.coverImage && (
                  <img
                    src={b.coverImage}
                    alt={b.title}
                    className="h-40 w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                )}
                <div className="flex flex-1 flex-col p-5">
                  {!b.published && <span className="mb-1 text-xs text-amber-500">draft</span>}
                  <h3 className="text-lg font-bold transition group-hover:text-brand-600">{b.title}</h3>
                  {b.excerpt && (
                    <p className="mt-1 line-clamp-3 flex-1 text-sm text-slate-500 dark:text-slate-400">
                      {b.excerpt}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={13} /> {b.readingMinutes} min
                    </span>
                    {b.publishedAt && <span>{new Date(b.publishedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
