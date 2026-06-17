import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProfile } from "../api/profile";
import { fetchSkills } from "../api/skills";
import SocialLinks from "../components/SocialLinks";
import SplashLoader from "../components/SplashLoader";
import Markdown from "../components/ui/Markdown";
import type { Skill } from "../types";

function groupByCategory(skills: Skill[]): Record<string, Skill[]> {
  return skills.reduce<Record<string, Skill[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});
}

// Plays the intro once per full page load (persists across in-app navigation).
let splashPlayed = false;

export default function Home() {
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const skillsQ = useQuery({ queryKey: ["skills"], queryFn: fetchSkills });

  // Intro splash: random 4–7s, then hide once data is also ready.
  const [duration] = useState(() => 4000 + Math.floor(Math.random() * 3000));
  const [showSplash, setShowSplash] = useState(!splashPlayed);
  const [minElapsed, setMinElapsed] = useState(false);

  // Start the min-duration timer whenever the splash is showing. Gating on
  // `showSplash` (not a module flag) keeps it correct under StrictMode's
  // double-mount, which would otherwise leave the timer cleared and the
  // overlay stuck on screen.
  useEffect(() => {
    if (!showSplash) return;
    splashPlayed = true;
    const t = setTimeout(() => setMinElapsed(true), duration);
    return () => clearTimeout(t);
  }, [showSplash, duration]);

  const ready = !profileQ.isLoading && !skillsQ.isLoading;
  useEffect(() => {
    if (showSplash && minElapsed && ready) setShowSplash(false);
  }, [showSplash, minElapsed, ready]);

  const profile = profileQ.data;
  const skills = skillsQ.data ?? [];
  const grouped = groupByCategory(skills);

  return (
    <>
      {/* Themed intro on first load; fades out once min time + data are ready. */}
      <AnimatePresence>{showSplash && <SplashLoader durationMs={duration} />}</AnimatePresence>
      <div className="container-page py-12 sm:py-16">
      {/* Hero */}
      <section className="grid items-center gap-10 md:grid-cols-[1.4fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="mb-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {profile?.headline || "Welcome to my portfolio"}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            {profile?.fullName || "Your Name"}
          </h1>
          {profile?.location && (
            <p className="mt-3 flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <MapPin size={16} /> {profile.location}
            </p>
          )}
          <div className="mt-5">
            <SocialLinks socials={profile?.socials ?? []} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/projects" className="btn-primary">
              View Projects
            </Link>
            <Link to="/resume" className="btn-ghost border border-slate-200 dark:border-slate-700">
              Resume
            </Link>
          </div>
        </motion.div>

        {profile?.imageUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="justify-self-center"
          >
            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-brand-400/30 to-brand-700/30 blur-2xl" />
              <img
                src={profile.imageUrl}
                alt={profile.fullName}
                className="relative h-56 w-56 rounded-3xl object-cover shadow-xl ring-1 ring-slate-200 dark:ring-slate-800 sm:h-64 sm:w-64"
              />
            </div>
          </motion.div>
        )}
      </section>

      {/* About */}
      {profile?.aboutMe && (
        <section className="mt-16">
          <h2 className="mb-4 text-2xl font-bold">About Me</h2>
          <div className="card p-6">
            <Markdown>{profile.aboutMe}</Markdown>
          </div>
        </section>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold">Skills</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="card p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                  {category}
                </h3>
                <div className="space-y-3">
                  {items.map((s) => (
                    <div key={s._id}>
                      <div className="mb-1 flex justify-between text-sm">
                        <Link
                          to={`/projects?skill=${encodeURIComponent(s.name)}`}
                          className="font-medium hover:text-brand-600 hover:underline"
                          title={`See projects using ${s.name}`}
                        >
                          {s.name}
                        </Link>
                        <span className="text-slate-400">{s.level}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${s.level}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8 }}
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {profile?.education && profile.education.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold">Education</h2>
          <div className="space-y-4">
            {profile.education.map((e, i) => (
              <div key={e._id ?? i} className="card flex gap-4 p-6">
                <div className="mt-1 text-brand-600 dark:text-brand-400">
                  <GraduationCap size={22} />
                </div>
                <div>
                  <h3 className="font-semibold">
                    {e.level}
                    {e.course && ` · ${e.course}`}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {e.institution}
                    {(e.startYear || e.endYear) && ` · ${e.startYear} – ${e.endYear}`}
                  </p>
                  {e.details && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{e.details}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </>
  );
}
