import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, FileUp, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  ingestDocument,
  ingestPdf,
  ragStatus,
  reingestPortfolio,
  resetIndex,
} from "../../api/chat";
import PageHeader from "../../components/ui/PageHeader";
import { apiErrorMessage } from "../../lib/api";

export default function ChatbotAdmin() {
  const qc = useQueryClient();
  const { data: status } = useQuery({ queryKey: ["rag-status"], queryFn: ragStatus, retry: false });
  const [docTitle, setDocTitle] = useState("");
  const [docText, setDocText] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const pdfRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["rag-status"] });
  const ok = (m: string) => {
    setMsg(m);
    setError("");
    refresh();
  };
  const fail = (e: unknown) => {
    setError(apiErrorMessage(e));
    setMsg("");
  };

  const reingest = useMutation({
    mutationFn: reingestPortfolio,
    onSuccess: (d) => ok(`Re-indexed portfolio: ${d.chunks} chunks.`),
    onError: fail,
  });
  const addDoc = useMutation({
    mutationFn: () => ingestDocument(docTitle, docText),
    onSuccess: (d) => {
      ok(`Added document: ${d.chunks} chunks.`);
      setDocTitle("");
      setDocText("");
    },
    onError: fail,
  });
  const addPdf = useMutation({
    mutationFn: (file: File) => ingestPdf(file, pdfTitle || file.name),
    onSuccess: (d) => {
      ok(`Indexed PDF: ${d.chunks} chunks.`);
      setPdfTitle("");
    },
    onError: fail,
  });
  const reset = useMutation({
    mutationFn: resetIndex,
    onSuccess: () => ok("Knowledge base cleared."),
    onError: fail,
  });

  return (
    <div>
      <PageHeader title="Chatbot / RAG" subtitle="Manage the knowledge base the assistant searches." />

      <div className="card mb-6 flex items-center gap-3 p-5">
        <Database className="text-brand-600" />
        <div className="flex-1">
          <p className="font-medium">Knowledge base</p>
          <p className="text-sm text-slate-400">
            {status ? `${status.indexed_chunks} chunks indexed in "${status.collection}"` : "Status unavailable"}
          </p>
        </div>
        <button className="btn-primary" disabled={reingest.isPending} onClick={() => reingest.mutate()}>
          {reingest.isPending ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Re-index portfolio
        </button>
      </div>

      {msg && <p className="mb-4 text-sm text-green-600">{msg}</p>}
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Paste a document */}
        <section className="card space-y-3 p-6">
          <h3 className="font-semibold">Add a document (paste text)</h3>
          <input
            className="input"
            placeholder="Title"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
          />
          <textarea
            className="input min-h-[160px]"
            placeholder="Paste notes, case studies, anything the bot should know…"
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={!docTitle.trim() || !docText.trim() || addDoc.isPending}
            onClick={() => addDoc.mutate()}
          >
            {addDoc.isPending ? <Loader2 className="animate-spin" size={16} /> : null} Add to knowledge base
          </button>
        </section>

        {/* Upload a PDF */}
        <section className="card space-y-3 p-6">
          <h3 className="font-semibold">Upload a PDF</h3>
          <input
            className="input"
            placeholder="Title (optional)"
            value={pdfTitle}
            onChange={(e) => setPdfTitle(e.target.value)}
          />
          <button
            className="btn-ghost border border-slate-200 dark:border-slate-700"
            disabled={addPdf.isPending}
            onClick={() => pdfRef.current?.click()}
          >
            {addPdf.isPending ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />} Choose PDF
          </button>
          <input
            ref={pdfRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => e.target.files?.[0] && addPdf.mutate(e.target.files[0])}
          />
          <p className="text-xs text-slate-400">Text is extracted and embedded for retrieval.</p>
        </section>
      </div>

      <div className="mt-6">
        <button
          className="btn-ghost text-red-500"
          onClick={() => {
            if (confirm("Clear the entire knowledge base? You'll need to re-index.")) reset.mutate();
          }}
        >
          <Trash2 size={16} /> Clear knowledge base
        </button>
      </div>
    </div>
  );
}
