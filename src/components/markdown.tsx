import type { ReactNode } from "react";

/**
 * Minimal Markdown → React renderer for policies.
 * Supports #/##/### headings, - and 1. lists, **bold**, _italic_, --- rules and paragraphs.
 * Never uses dangerouslySetInnerHTML: every piece of text goes through React, which escapes it,
 * so HTML or script in AI output or in a user's edit is shown as text, never run. Links are not rendered.
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith("**") ? <strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong> : <em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(<p key={k} className="my-2">{inline(para.join(" "), k)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`;
      const items = list.items.map((it, i) => <li key={`${k}-${i}`}>{inline(it, `${k}-${i}`)}</li>);
      blocks.push(list.ordered ? <ol key={k} className="my-2 list-decimal space-y-1 pl-6">{items}</ol> : <ul key={k} className="my-2 list-disc space-y-1 pl-6">{items}</ul>);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      const k = `h${blocks.length}`;
      const level = h[1].length;
      const cls = level === 1 ? "mb-3 mt-1 text-2xl font-bold" : level === 2 ? "mb-1 mt-6 text-lg font-semibold" : "mb-1 mt-4 font-semibold";
      const content = inline(h[2], k);
      blocks.push(level === 1 ? <h2 key={k} className={cls}>{content}</h2> : level === 2 ? <h3 key={k} className={cls}>{content}</h3> : <h4 key={k} className={cls}>{content}</h4>);
    } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      flushPara(); flushList();
      blocks.push(<hr key={`r${blocks.length}`} className="my-4 border-line" />);
    } else if (ul || ol) {
      flushPara();
      const ordered = Boolean(ol);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return <div className="text-sm leading-relaxed text-ink">{blocks}</div>;
}
