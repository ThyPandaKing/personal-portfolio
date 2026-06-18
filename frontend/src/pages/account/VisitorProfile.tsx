import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchMyProfile, updateMyProfile, type ProfileInput } from "../../api/users";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/ui/PageHeader";
import Spinner from "../../components/ui/Spinner";
import StatusNote, { type Status } from "../../components/ui/StatusNote";
import { apiErrorMessage } from "../../lib/api";

const blank: ProfileInput = { name: "", headline: "", bio: "", location: "" };

export default function VisitorProfile() {
  const qc = useQueryClient();
  const { user, refresh } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMyProfile });
  const [form, setForm] = useState<ProfileInput>(blank);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? "",
        headline: data.headline ?? "",
        bio: data.bio ?? "",
        location: data.location ?? "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (p: ProfileInput) => updateMyProfile(p),
    onMutate: () => setStatus("saving"),
    onSuccess: (saved) => {
      setStatus("saved");
      qc.setQueryData(["me"], saved);
      void refresh(); // keep the navbar avatar/name in sync
      setTimeout(() => setStatus("idle"), 1500);
    },
    onError: (e) => {
      setStatus("error");
      setError(apiErrorMessage(e));
    },
  });

  if (isLoading) return <Spinner />;

  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Your account details."
        action={
          <div className="flex items-center gap-3">
            <StatusNote status={status} error={error} />
            <button
              className="btn-primary"
              disabled={!form.name.trim() || save.isPending}
              onClick={() => save.mutate(form)}
            >
              Save changes
            </button>
          </div>
        }
      />

      <section className="card space-y-4 p-6">
        <div className="flex items-center gap-4">
          {user?.picture && (
            <img src={user.picture} alt="" className="h-16 w-16 rounded-full object-cover" />
          )}
          <div>
            <p className="font-medium">{user?.email}</p>
            <p className="text-sm text-slate-400">Signed in with Google</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Headline</label>
            <input
              className="input"
              value={form.headline}
              placeholder="e.g. Frontend developer"
              onChange={(e) => set("headline", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              value={form.location}
              placeholder="e.g. Bengaluru, India"
              onChange={(e) => set("location", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">About you (markdown)</label>
          <textarea
            className="input min-h-[160px] font-mono text-sm"
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="A short bio. Markdown supported."
          />
        </div>
      </section>
    </div>
  );
}
