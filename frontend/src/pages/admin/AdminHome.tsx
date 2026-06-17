import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/ui/PageHeader";

const cards = [
  { to: "/admin/profile", title: "Home / Profile", desc: "About, image, socials, education." },
  { to: "/admin/projects", title: "Projects", desc: "Add, edit, archive, upload assets." },
  { to: "/admin/blog", title: "Blog", desc: "Write and publish articles." },
  { to: "/admin/resumes", title: "Resumes", desc: "Manage public resumes & AI generator." },
  { to: "/admin/chatbot", title: "Chatbot / RAG", desc: "Upload docs and retrain the bot." },
];

export default function AdminHome() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Signed in as ${user?.email ?? ""}`} />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="card p-6 transition hover:border-brand-400">
            <h3 className="font-semibold">{c.title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
