import {
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  User,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const sections = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/profile", label: "Home / Profile", icon: User },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/blog", label: "Blog", icon: Newspaper },
  { to: "/admin/resumes", label: "Resumes", icon: FileText },
  { to: "/admin/chatbot", label: "Chatbot / RAG", icon: MessageSquare },
];

export default function AdminLayout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-accent text-accent-contrast"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  return (
    <div className="container-page grid gap-8 py-10 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-20 md:h-fit">
        <h2 className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Admin
        </h2>
        <nav className="flex flex-col gap-1">
          {sections.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.end} className={linkClass}>
              <s.icon size={18} />
              {s.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
