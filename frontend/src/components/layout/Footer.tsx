export default function Footer() {
  return (
    <footer className="border-t border-slate-200 py-8 dark:border-slate-800">
      <div className="container-page flex flex-col items-center justify-between gap-2 text-sm text-slate-500 sm:flex-row">
        <p>© {new Date().getFullYear()} · Built with React, Express & LangGraph</p>
        <p className="text-slate-400">Powered by Gemini</p>
      </div>
    </footer>
  );
}
