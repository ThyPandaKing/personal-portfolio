import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchProfile, updateProfile, uploadProfileImage } from "../../api/profile";
import SkillsManager from "../../components/admin/SkillsManager";
import PageHeader from "../../components/ui/PageHeader";
import Spinner from "../../components/ui/Spinner";
import StatusNote, { type Status } from "../../components/ui/StatusNote";
import { apiErrorMessage } from "../../lib/api";
import type { Education, Profile, Social } from "../../types";

const emptyEducation: Education = {
  level: "",
  course: "",
  institution: "",
  startYear: "",
  endYear: "",
  details: "",
};

export default function ProfileEditor() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const [form, setForm] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (p: Profile) => updateProfile(p),
    onMutate: () => setStatus("saving"),
    onSuccess: (saved) => {
      setStatus("saved");
      qc.setQueryData(["profile"], saved);
      setTimeout(() => setStatus("idle"), 1500);
    },
    onError: (e) => {
      setStatus("error");
      setError(apiErrorMessage(e));
    },
  });

  if (isLoading || !form) return <Spinner />;

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const handleImage = async (file: File) => {
    try {
      setStatus("saving");
      const url = await uploadProfileImage(file);
      set("imageUrl", url);
      setStatus("saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      setStatus("error");
      setError(apiErrorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Home / Profile"
        subtitle="Everything on your Home page."
        action={
          <div className="flex items-center gap-3">
            <StatusNote status={status} error={error} />
            <button className="btn-primary" onClick={() => save.mutate(form)}>
              Save changes
            </button>
          </div>
        }
      />

      <div className="space-y-6">
        {/* Basics */}
        <section className="card space-y-4 p-6">
          <h3 className="font-semibold">Basics</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Headline / tagline</label>
              <input
                className="input"
                value={form.headline}
                onChange={(e) => set("headline", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Location</label>
              <input
                className="input"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Contact email</label>
              <input
                className="input"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Profile image</label>
            <div className="flex items-center gap-4">
              {form.imageUrl && (
                <img src={form.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
              )}
              <button
                className="btn-ghost border border-slate-200 dark:border-slate-700"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={16} /> Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])}
              />
            </div>
          </div>
        </section>

        {/* About */}
        <section className="card space-y-2 p-6">
          <h3 className="font-semibold">About me (markdown)</h3>
          <textarea
            className="input min-h-[160px] font-mono text-sm"
            value={form.aboutMe}
            onChange={(e) => set("aboutMe", e.target.value)}
            placeholder="Write about yourself. Markdown supported."
          />
        </section>

        {/* Socials */}
        <section className="card space-y-3 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Social profiles</h3>
            <button
              className="btn-ghost text-sm"
              onClick={() => set("socials", [...form.socials, { platform: "", url: "" }])}
            >
              <Plus size={16} /> Add
            </button>
          </div>
          {form.socials.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Platform (github, linkedin…)"
                value={s.platform}
                onChange={(e) => {
                  const next = [...form.socials];
                  next[i] = { ...next[i], platform: e.target.value } as Social;
                  set("socials", next);
                }}
              />
              <input
                className="input flex-[2]"
                placeholder="URL"
                value={s.url}
                onChange={(e) => {
                  const next = [...form.socials];
                  next[i] = { ...next[i], url: e.target.value } as Social;
                  set("socials", next);
                }}
              />
              <button
                className="btn-ghost text-red-500"
                onClick={() => set("socials", form.socials.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>

        {/* Education */}
        <section className="card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Education</h3>
            <button
              className="btn-ghost text-sm"
              onClick={() => set("education", [...form.education, { ...emptyEducation }])}
            >
              <Plus size={16} /> Add
            </button>
          </div>
          {form.education.map((ed, i) => {
            const update = (patch: Partial<Education>) => {
              const next = [...form.education];
              next[i] = { ...next[i], ...patch };
              set("education", next);
            };
            return (
              <div key={i} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="input"
                    placeholder="Level (e.g. B.Tech)"
                    value={ed.level}
                    onChange={(e) => update({ level: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Course"
                    value={ed.course}
                    onChange={(e) => update({ course: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Institution"
                    value={ed.institution}
                    onChange={(e) => update({ institution: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <input
                      className="input"
                      placeholder="Start year"
                      value={ed.startYear}
                      onChange={(e) => update({ startYear: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="End year"
                      value={ed.endYear}
                      onChange={(e) => update({ endYear: e.target.value })}
                    />
                  </div>
                </div>
                <textarea
                  className="input mt-3"
                  placeholder="Details"
                  value={ed.details}
                  onChange={(e) => update({ details: e.target.value })}
                />
                <button
                  className="btn-ghost mt-2 text-sm text-red-500"
                  onClick={() => set("education", form.education.filter((_, j) => j !== i))}
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            );
          })}
        </section>

        {/* Skills */}
        <SkillsManager />
      </div>
    </div>
  );
}
