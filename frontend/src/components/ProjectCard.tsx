import { motion } from "framer-motion";
import { ArrowUpRight, Github, Star } from "lucide-react";
import { Link } from "react-router-dom";
import type { Project } from "../types";

const typeLabel: Record<Project["type"], string> = {
  enterprise: "Enterprise",
  personal: "Personal",
  archive: "Archive",
};

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="card group flex flex-col overflow-hidden"
    >
      {project.coverImage && (
        <Link to={`/projects/${project.slug}`} className="block overflow-hidden">
          <img
            src={project.coverImage}
            alt={project.title}
            className="h-44 w-full object-cover transition duration-300 group-hover:scale-105"
          />
        </Link>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {typeLabel[project.type]}
          </span>
          {project.featured && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Star size={12} fill="currentColor" /> Featured
            </span>
          )}
        </div>

        <Link to={`/projects/${project.slug}`}>
          <h3 className="text-lg font-bold transition group-hover:text-brand-600">{project.title}</h3>
        </Link>
        {project.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
            {project.summary}
          </p>
        )}

        {project.skillsUsed.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.skillsUsed.slice(0, 4).map((s) => (
              <span
                key={s}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 pt-2 text-sm">
          <Link
            to={`/projects/${project.slug}`}
            className="flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
          >
            Details <ArrowUpRight size={15} />
          </Link>
          {project.githubLink && (
            <a
              href={project.githubLink}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <Github size={16} />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
