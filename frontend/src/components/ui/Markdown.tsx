import ReactMarkdown from "react-markdown";

/** Renders markdown with Tailwind-friendly styling. */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-portfolio space-y-3 text-slate-700 dark:text-slate-300">
      <ReactMarkdown
        components={{
          h1: (p) => <h1 className="text-2xl font-bold text-slate-900 dark:text-white" {...p} />,
          h2: (p) => <h2 className="text-xl font-bold text-slate-900 dark:text-white" {...p} />,
          h3: (p) => <h3 className="text-lg font-semibold text-slate-900 dark:text-white" {...p} />,
          p: (p) => <p className="leading-relaxed" {...p} />,
          ul: (p) => <ul className="list-disc space-y-1 pl-5" {...p} />,
          ol: (p) => <ol className="list-decimal space-y-1 pl-5" {...p} />,
          a: (p) => <a className="text-brand-600 underline hover:text-brand-700" {...p} />,
          code: (p) => (
            <code
              className="rounded bg-slate-100 px-1 py-0.5 text-sm dark:bg-slate-800"
              {...p}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
