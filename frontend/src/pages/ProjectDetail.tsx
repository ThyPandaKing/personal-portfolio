import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, FileText, Github, PlayCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchProject } from "../api/projects";
import Markdown from "../components/ui/Markdown";
import Spinner from "../components/ui/Spinner";
import type { ProjectAsset } from "../types";

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      <div className="card p-6">
        <Markdown>{body}</Markdown>
      </div>
    </section>
  );
}

function AssetItem({ asset }: { asset: ProjectAsset }) {
  if (asset.type === "recording") {
    const isAudio = asset.mimeType.startsWith("audio");
    return (
      <div className="card p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium">
          <PlayCircle size={16} /> {asset.name || "Recording"}
        </p>
        {isAudio ? (
          <audio controls src={asset.url} className="w-full" />
        ) : (
          <video controls src={asset.url} className="w-full rounded-lg" />
        )}
      </div>
    );
  }
  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noreferrer"
      className="card flex items-center gap-3 p-4 transition hover:border-brand-400"
    >
      <FileText size={18} className="text-brand-600" />
      <span className="flex-1 text-sm font-medium">{asset.name || "Document.pdf"}</span>
      <ExternalLink size={15} className="text-slate-400" />
    </a>
  );
}

export default function ProjectDetail() {
  const { slug = "" } = useParams();
  const { data: project, isLoading, isError } = useQuery({
    queryKey: ["project", slug],
    queryFn: () => fetchProject(slug),
  });

  if (isLoading) return <Spinner />;
  if (isError || !project)
    return (
      <div className="container-page py-20 text-center text-slate-400">
        Project not found.{" "}
        <Link to="/projects" className="text-brand-600 underline">
          Back to projects
        </Link>
      </div>
    );

  return (
    <div className="container-page py-12">
      <Link
        to="/projects"
        className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft size={16} /> All projects
      </Link>

      {project.coverImage && (
        <img
          src={project.coverImage}
          alt={project.title}
          className="mb-8 h-64 w-full rounded-2xl object-cover"
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {project.type}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{project.title}</h1>
          {project.summary && (
            <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">{project.summary}</p>
          )}
        </div>
        <div className="flex gap-2">
          {project.demoLink && (
            <a href={project.demoLink} target="_blank" rel="noreferrer" className="btn-primary">
              <ExternalLink size={16} /> Demo
            </a>
          )}
          {project.githubLink && (
            <a
              href={project.githubLink}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost border border-slate-200 dark:border-slate-700"
            >
              <Github size={16} /> Code
            </a>
          )}
        </div>
      </div>

      {project.skillsUsed.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {project.skillsUsed.map((s) => (
            <Link
              key={s}
              to={`/projects?skill=${encodeURIComponent(s)}`}
              className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-brand-100 hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-brand-900/40 dark:hover:text-brand-300"
              title={`See projects using ${s}`}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      <Section title="About" body={project.about} />
      <Section title="Impact" body={project.impact} />
      <Section title="Learnings" body={project.learning} />

      {project.assets.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold">Recordings & Documents</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {project.assets.map((a) => (
              <AssetItem key={a._id} asset={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
