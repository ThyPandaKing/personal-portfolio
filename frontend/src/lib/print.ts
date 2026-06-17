/**
 * Open a print-optimized window for some rendered HTML and trigger the browser's
 * print dialog (→ "Save as PDF"). Anchor links are preserved as clickable links
 * in the resulting PDF, which is why we print HTML rather than rasterize.
 */
export function printResume(title: string, bodyHtml: string): void {
  const win = window.open("", "_blank", "width=840,height=1000");
  if (!win) {
    alert("Please allow pop-ups to download the PDF.");
    return;
  }
  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Inter, -apple-system, Segoe UI, Arial, sans-serif;
    color: #0f172a; line-height: 1.5; max-width: 760px;
    margin: 40px auto; padding: 0 28px;
  }
  h1 { font-size: 1.7rem; margin: 0 0 .2em; }
  h2 { font-size: 1.15rem; margin: 1.4em 0 .4em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 1rem; margin: 1em 0 .3em; }
  p, li { font-size: .95rem; }
  ul { padding-left: 1.2em; margin: .3em 0; }
  a { color: #4f46e5; text-decoration: none; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.2em 0; }
  @page { margin: 16mm; }
  @media print { body { margin: 0; max-width: none; } }
</style>
</head>
<body>
${bodyHtml}
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
