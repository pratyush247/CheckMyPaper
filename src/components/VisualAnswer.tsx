"use client";

// Renders an AI-generated SVG diagram inside a locked-down iframe (no scripts,
// no same-origin) so generated markup can never touch the app. White "whiteboard"
// canvas keeps the dark-on-light diagram readable in both themes.
export function VisualAnswer({ svg }: { svg: string }) {
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:8px;background:#fff;box-sizing:border-box}
    body{display:flex;align-items:center;justify-content:center;min-height:100%}
    svg{max-width:100%;max-height:360px;height:auto;width:auto}
  </style></head><body>${svg}</body></html>`;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white">
      <iframe
        sandbox=""
        srcDoc={doc}
        title="Visual explanation"
        className="block w-full"
        style={{ height: 380, border: 0 }}
      />
    </div>
  );
}
