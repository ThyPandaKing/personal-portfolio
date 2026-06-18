import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { fetchVisitors } from "../../api/users";
import PageHeader from "../../components/ui/PageHeader";
import Spinner from "../../components/ui/Spinner";

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

export default function VisitorsAdmin() {
  const [q, setQ] = useState("");
  const { data: visitors = [], isLoading } = useQuery({
    queryKey: ["visitors", q],
    queryFn: () => fetchVisitors(q.trim() || undefined),
  });

  return (
    <div>
      <PageHeader title="Visitors" subtitle="People who have signed in to your site." />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          className="input pl-9"
          placeholder="Search by name, email, headline, or location…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {visitors.map((v) => (
            <div key={v.id} className="flex items-center gap-3 p-4">
              {v.picture ? (
                <img src={v.picture} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-500 dark:bg-slate-700">
                  {(v.name || v.email).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{v.name || "(no name)"}</p>
                <p className="truncate text-sm text-slate-400">{v.email}</p>
                {(v.headline || v.location) && (
                  <p className="truncate text-xs text-slate-400">
                    {[v.headline, v.location].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="hidden text-right text-xs text-slate-400 sm:block">
                <p>Joined {formatDate(v.createdAt)}</p>
                <p>Last seen {formatDate(v.lastLoginAt)}</p>
              </div>
            </div>
          ))}
          {visitors.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">
              {q ? "No visitors match your search." : "No visitors yet."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
