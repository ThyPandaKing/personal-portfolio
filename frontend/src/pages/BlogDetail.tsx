import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchBlog } from "../api/blogs";
import Markdown from "../components/ui/Markdown";
import Spinner from "../components/ui/Spinner";

export default function BlogDetail() {
  const { slug = "" } = useParams();
  const { data: blog, isLoading, isError } = useQuery({
    queryKey: ["blog", slug],
    queryFn: () => fetchBlog(slug),
  });

  if (isLoading) return <Spinner />;
  if (isError || !blog)
    return (
      <div className="container-page py-20 text-center text-slate-400">
        Article not found.{" "}
        <Link to="/blog" className="text-brand-600 underline">
          Back to blog
        </Link>
      </div>
    );

  return (
    <article className="container-page max-w-3xl py-12">
      <Link to="/blog" className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} /> All articles
      </Link>

      <h1 className="text-3xl font-extrabold sm:text-4xl">{blog.title}</h1>
      <div className="mt-3 flex items-center gap-3 text-sm text-slate-400">
        <span className="flex items-center gap-1">
          <Clock size={14} /> {blog.readingMinutes} min read
        </span>
        {blog.publishedAt && <span>{new Date(blog.publishedAt).toLocaleDateString()}</span>}
      </div>

      {blog.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {blog.tags.map((t) => (
            <span
              key={t}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {blog.coverImage && (
        <img src={blog.coverImage} alt={blog.title} className="mt-6 w-full rounded-2xl object-cover" />
      )}

      <div className="mt-8">
        <Markdown>{blog.content}</Markdown>
      </div>
    </article>
  );
}
