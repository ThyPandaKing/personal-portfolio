import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export type Status = "idle" | "saving" | "saved" | "error";

export default function StatusNote({ status, error }: { status: Status; error?: string }) {
  if (status === "idle") return null;
  if (status === "saving")
    return (
      <span className="flex items-center gap-1 text-sm text-slate-400">
        <Loader2 className="animate-spin" size={15} /> Saving…
      </span>
    );
  if (status === "saved")
    return (
      <span className="flex items-center gap-1 text-sm text-green-600">
        <CheckCircle2 size={15} /> Saved
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-sm text-red-500">
      <AlertCircle size={15} /> {error || "Error"}
    </span>
  );
}
