import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchProjects } from "../api/projects";
import { fetchSkills } from "../api/skills";
import ProjectCard from "../components/ProjectCard";
import PageHeader from "../components/ui/PageHeader";
import Spinner from "../components/ui/Spinner";
import type { ProjectType } from "../types";

const tabs: { key: ProjectType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "enterprise", label: "Enterprise" },
  { key: "personal", label: "Personal" },
  { key: "archive", label: "Archive" },
];

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("type") as ProjectType | null) ?? "all";
  const skill = params.get("skill") ?? "";
  const [q, setQ] = useState("");

  const { data: skills = [] } = useQuery({ queryKey: ["skills"], queryFn: fetchSkills });
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", tab, skill, q],
    queryFn: () =>
      fetchProjects({ type: tab === "all" ? undefined : tab, skill: skill || undefined, q: q || undefined }),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="container-page py-12">
      <PageHeader title="Projects" subtitle="A mix of enterprise work, personal builds, and archived experiments." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Type tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setParam("type", t.key === "all" ? "" : t.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === t.key
                  ? "bg-accent text-accent-contrast"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Skill / tool filter */}
          <select
            value={skill}
            onChange={(e) => setParam("skill", e.target.value)}
            className="input w-auto py-1.5 text-sm"
            aria-label="Filter by skill or tool"
          >
            <option value="">All skills / tools</option>
            {skills.map((s) => (
              <option key={s._id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Content search */}
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search content…"
              className="input w-56 py-1.5 pl-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Active skill chip */}
      {skill && (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <span className="text-slate-500">Filtered by skill:</span>
          <button
            onClick={() => setParam("skill", "")}
            className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
          >
            {skill} <X size={14} />
          </button>
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : projects.length === 0 ? (
        <p className="py-16 text-center text-slate-400">No projects match these filters.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p._id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
