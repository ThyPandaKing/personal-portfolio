import { Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFile } from "../../api/uploads";
import { apiErrorMessage } from "../../lib/api";

interface Props {
  label: string;
  value: string;
  onChange: (url: string) => void;
}

/** Reusable image picker: shows a preview, uploads to /api/uploads, returns the URL. */
export default function ImageUploadField({ label, value, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handle = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const { url } = await uploadFile(file);
      onChange(url);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-4">
        {value && (
          <div className="relative">
            <img src={value} alt="" className="h-16 w-24 rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <button
          type="button"
          className="btn-ghost border border-slate-200 dark:border-slate-700"
          disabled={busy}
          onClick={() => ref.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />} Upload
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
