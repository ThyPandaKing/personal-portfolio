import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Lightbulb, Send, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { sendChat } from "../../api/chat";
import type { ChatMessage } from "../../types";
import BotAvatar from "../BotAvatar";

// Shown for any failure — never leak raw error logs to visitors.
const MAINTENANCE_MESSAGE =
  "⚠️ ChatBot is not working due to maintenance — kindly reach out to Aditya or check the [Projects](/projects) page.";

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

// Compact, chat-bubble-friendly markdown styling (bold, italics, links, lists, code).
const mdComponents: Components = {
  p: (p) => <p className="mb-2 leading-relaxed last:mb-0" {...p} />,
  strong: (p) => <strong className="font-semibold text-slate-900 dark:text-white" {...p} />,
  em: (p) => <em className="italic" {...p} />,
  a: (p) => (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand-600 underline decoration-brand-400 underline-offset-2 hover:text-brand-700 dark:text-brand-300"
      {...p}
    />
  ),
  ul: (p) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0" {...p} />,
  ol: (p) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  code: (p) => <code className="rounded bg-black/10 px-1 py-0.5 text-[0.85em] dark:bg-white/15" {...p} />,
  h1: (p) => <h3 className="mb-1 mt-1 text-base font-bold" {...p} />,
  h2: (p) => <h3 className="mb-1 mt-1 text-base font-bold" {...p} />,
  h3: (p) => <h4 className="mb-1 mt-1 font-semibold" {...p} />,
  blockquote: (p) => <blockquote className="border-l-2 border-brand-400 pl-2 italic opacity-90" {...p} />,
};

/**
 * Renders an assistant message as markdown. When `animate` is set, the text is
 * revealed progressively (ChatGPT-style typewriter) before settling on the full
 * answer; `onTick` fires as text grows so the view can keep scrolling.
 */
function AssistantMessage({
  text,
  animate,
  onTick,
  onDone,
}: {
  text: string;
  animate: boolean;
  onTick?: () => void;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState(animate ? "" : text);

  useEffect(() => {
    if (!animate) {
      setShown(text);
      return;
    }
    let i = 0;
    // Reveal faster for long answers so total time stays ~2s, slower for short ones.
    const step = Math.max(2, Math.ceil(text.length / 140));
    const id = setInterval(() => {
      i += step;
      if (i >= text.length) {
        setShown(text);
        clearInterval(id);
        onDone?.();
      } else {
        setShown(text.slice(0, i));
        onTick?.();
      }
    }, 16);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animate]);

  return (
    <div className="text-sm">
      <ReactMarkdown components={mdComponents}>{shown}</ReactMarkdown>
      {animate && shown.length < text.length && (
        <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-slate-400 align-text-bottom" />
      )}
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [loading, setLoading] = useState(false);
  const [typingIdx, setTypingIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToEnd = useCallback(() => endRef.current?.scrollIntoView({ block: "end" }), []);

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
      setMessages((m) => {
        setTypingIdx(m.length); // the assistant message about to be appended
        return [...m, { role: "assistant", content: reply.answer, sources: reply.sources }];
      });
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: MAINTENANCE_MESSAGE }]);
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
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-glow transition hover:bg-accent-hover hover:shadow-glow-lg"
        aria-label="Chat"
      >
        {open ? <X size={24} /> : <BotAvatar className="h-12 w-12" />}
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
            <div className="flex items-center gap-3 border-b border-black/10 bg-accent p-4 text-accent-contrast">
              <BotAvatar className="h-12 w-12 shrink-0" />
              <div>
                <p className="font-semibold leading-tight">Talk to AI-ditya 🤖</p>
                <p className="text-xs text-accent-contrast/70">AI bot · Powered by Gemini · RAG</p>
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
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <AssistantMessage
                        text={m.content}
                        animate={i === typingIdx}
                        onTick={scrollToEnd}
                        onDone={() => setTypingIdx(null)}
                      />
                    )}
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
