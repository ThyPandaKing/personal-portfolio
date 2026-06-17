import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { useRef, useState } from "react";
import { fetchResumes } from "../api/resumes";
import Markdown from "../components/ui/Markdown";
import PageHeader from "../components/ui/PageHeader";
import Spinner from "../components/ui/Spinner";
import { printResume } from "../lib/print";
import type { Resume as ResumeType } from "../types";

export default function Resume() {
  const { data: resumes = [], isLoading } = useQuery({ queryKey: ["resumes"], queryFn: fetchResumes });
  const [active, setActive] = useState<string | null>(null);

  if (isLoading) return <Spinner />;

  const selected = resumes.find((r) => r._id === active) ?? resumes[0];

  return (
    <div className="container-page py-12">
      <PageHeader title="Resume" subtitle="Pick the version that fits the role." />

      {resumes.length === 0 ? (
        <p className="py-16 text-center text-slate-400">No public resumes available yet.</p>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap gap-3">
            {resumes.map((r) => (
              <button
                key={r._id}
                onClick={() => setActive(r._id)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-left transition ${
                  selected?._id === r._id
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-slate-200 hover:border-brand-300 dark:border-slate-700"
                }`}
              >
                <FileText size={18} className="text-brand-600" />
                <div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-xs text-slate-400">{r.role} role</p>
                </div>
              </button>
            ))}
          </div>

          {selected && <ResumeView resume={selected} />}
        </>
      )}
    </div>
  );
}

function ResumeView({ resume }: { resume: ResumeType }) {
  const contentRef = useRef<HTMLDivElement>(null);

  if (resume.source === "generated" && resume.content) {
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => contentRef.current && printResume(resume.title, contentRef.current.innerHTML)}
            className="btn-primary"
          >
            <Download size={16} /> Download PDF
          </button>
        </div>
        <div ref={contentRef} className="card p-8">
          <Markdown>{resume.content}</Markdown>
        </div>
      </div>
    );
  }
  if (resume.fileUrl) {
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <a href={resume.fileUrl} download target="_blank" rel="noreferrer" className="btn-primary">
            <Download size={16} /> Download PDF
          </a>
        </div>
        <div className="card overflow-hidden">
          <object data={resume.fileUrl} type="application/pdf" className="h-[80vh] w-full">
            <p className="p-6 text-center text-slate-400">
              Can’t preview the PDF.{" "}
              <a href={resume.fileUrl} className="text-brand-600 underline">
                Download it instead
              </a>
              .
            </p>
          </object>
        </div>
      </div>
    );
  }
  return <p className="py-12 text-center text-slate-400">This resume has no content yet.</p>;
}
