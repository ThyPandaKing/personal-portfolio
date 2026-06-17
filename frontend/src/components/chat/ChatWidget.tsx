import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Lightbulb, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sendChat } from "../../api/chat";
import { apiErrorMessage } from "../../lib/api";
import type { ChatMessage } from "../../types";
import GuyAvatar from "../GuyAvatar";

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hi! Ask me anything about the projects, skills, or experience here — or pick an option below.",
};

type Mode = "recruiter" | "project" | null;

// Wrap the visitor's raw input into a richer prompt for the agent.
const recruiterPrompt = (skills: string) =>
  `I'm a recruiter evaluating this candidate for a role. The requirements / skills I care about are: "${skills}". ` +
  `Based on the portfolio (projects, skills, experience, documents), assess how well the candidate fits, ` +
  `list the most relevant projects and skills with specifics, and call out any gaps honestly.`;

const projectPrompt = (details: string) =>
  `Here are details about a project or problem: "${details}". Based on the owner's portfolio, give insights: ` +
  `what relevant experience and similar projects the owner has, which of their skills/tools apply, and how they'd approach it.`;

const GENERAL_DISPLAY = "Give me an overview of the owner and their standout work.";

const starters: { mode: Mode; label: string; icon: typeof Briefcase; hint: string }[] = [
  { mode: "recruiter", label: "I'm a recruiter", icon: Briefcase, hint: "Enter the skills / requirements you're hiring for, then send." },
  { mode: "project", label: "Insights on a project", icon: Lightbulb, hint: "Describe the project (or paste details), then send." },
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const submit = async (rawText: string, wrapped?: string) => {
    const text = rawText.trim();
    if (!text || loading) return;
    const history = messages.filter((m) => m !== GREETING);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setMode(null);
    setLoading(true);
    try {
      const reply = await sendChat(wrapped ?? text, history);
      setMessages((m) => [...m, { role: "assistant", content: reply.answer, sources: reply.sources }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${apiErrorMessage(e, "The assistant is unavailable.")}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    const raw = input;
    const wrapped =
      mode === "recruiter" ? recruiterPrompt(raw) : mode === "project" ? projectPrompt(raw) : undefined;
    submit(raw, wrapped);
  };

  const pickStarter = (m: Mode) => {
    setMode(m);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const showStarters = messages.length === 1 && !loading;
  const placeholder =
    mode === "recruiter"
      ? "e.g. React, Node, distributed systems…"
      : mode === "project"
        ? "Describe the project or paste details…"
        : "Ask about a project…";

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-glow transition hover:bg-accent-hover hover:shadow-glow-lg"
        aria-label="Chat"
      >
        {open ? <X size={22} /> : <GuyAvatar className="h-8 w-8" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="card fixed bottom-24 right-6 z-50 flex h-[78vh] max-h-[680px] w-[94vw] max-w-md flex-col overflow-hidden"
          >
            <div className="flex items-center gap-2.5 border-b border-black/10 bg-accent p-4 text-accent-contrast">
              <GuyAvatar className="h-9 w-9 shrink-0" />
              <div>
                <p className="font-semibold leading-tight">Portfolio Assistant</p>
                <p className="text-xs text-accent-contrast/70">Powered by Gemini · RAG</p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-accent text-accent-contrast"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.sources.map((s, j) => (
                          <span
                            key={j}
                            className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-black/30 dark:text-slate-300"
                          >
                            {s.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Starter options */}
              {showStarters && (
                <div className="space-y-2 pt-1">
                  {starters.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => pickStarter(s.mode)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                        mode === s.mode
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
                          : "border-slate-200 hover:border-brand-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      }`}
                    >
                      <s.icon size={16} className="text-brand-600" />
                      {s.label}
                    </button>
                  ))}
                  <button
                    onClick={() => submit(GENERAL_DISPLAY)}
                    className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-brand-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <Sparkles size={16} className="text-brand-600" />
                    Overview of the owner & standout work
                  </button>
                </div>
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                    <span className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.3s]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="border-t border-slate-200 p-3 dark:border-slate-800">
              {mode && (
                <p className="mb-2 flex items-center justify-between text-xs text-brand-600 dark:text-brand-400">
                  <span>{starters.find((s) => s.mode === mode)?.hint}</span>
                  <button onClick={() => setMode(null)} className="text-slate-400 hover:text-slate-600">
                    cancel
                  </button>
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  className="input"
                  placeholder={placeholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <button onClick={handleSend} disabled={loading} className="btn-primary px-3">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
