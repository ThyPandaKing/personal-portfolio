import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center justify-center gap-4 py-32 text-center">
      <h1 className="text-6xl font-extrabold text-brand-600">404</h1>
      <p className="text-slate-500 dark:text-slate-400">This page doesn’t exist.</p>
      <Link to="/" className="btn-primary">
        Back home
      </Link>
    </div>
  );
}
