import { Github, Globe, Instagram, Linkedin, Mail, Twitter, Youtube } from "lucide-react";
import type { Social } from "../types";

const iconFor = (platform: string) => {
  const p = platform.toLowerCase();
  if (p.includes("git")) return Github;
  if (p.includes("linked")) return Linkedin;
  if (p.includes("twitter") || p === "x") return Twitter;
  if (p.includes("insta")) return Instagram;
  if (p.includes("you")) return Youtube;
  if (p.includes("mail") || p.includes("email")) return Mail;
  return Globe;
};

export default function SocialLinks({ socials }: { socials: Social[] }) {
  if (!socials?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {socials.map((s) => {
        const Icon = iconFor(s.platform);
        const href = s.platform.toLowerCase().includes("mail") ? `mailto:${s.url}` : s.url;
        return (
          <a
            key={`${s.platform}-${s.url}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            title={s.platform}
            className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500"
          >
            <Icon size={18} />
          </a>
        );
      })}
    </div>
  );
}
