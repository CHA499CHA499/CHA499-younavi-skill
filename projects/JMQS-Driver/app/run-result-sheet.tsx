"use client";

import { useEffect, useRef, useState } from "react";
import { buildRunResultTitle } from "./run-result-presentation.mjs";
import styles from "./run-result-sheet.module.css";

export interface RunResultSheetProps {
  open: boolean;
  markdown: string | null | undefined;
  resultTitle?: string;
  task?: string;
  personaName: string;
  skillName: string;
  commandId?: string;
  promptCode: string;
  promptLabel: string;
  instruction?: string;
  sourceDisplayName?: string;
  sourceTechnicalName?: string;
  sourcePath?: string;
  sourceSha256?: string;
  runId?: string;
  taskId?: string;
  conversationId?: string;
  coverage?: string;
  onOpenInYouNavi?: () => Promise<void>;
  onClose: () => void;
}

type OpenActionState = "idle" | "loading" | "success" | "error";

const OPEN_ACTION_LABELS: Record<OpenActionState, string> = {
  idle: "打开 YouNavi",
  loading: "正在打开…",
  success: "YouNavi 已打开",
  error: "打开失败，重试",
};

export function RunResultSheet({ open, markdown, resultTitle, task, personaName, skillName, commandId, promptCode, promptLabel, instruction, sourceDisplayName, sourceTechnicalName, sourcePath, sourceSha256, runId, taskId, conversationId, coverage, onOpenInYouNavi, onClose }: RunResultSheetProps) {
  const [openActionState, setOpenActionState] = useState<OpenActionState>("idle");
  const [openActionError, setOpenActionError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const resetTimer = window.setTimeout(() => {
      setOpenActionState("idle");
      setOpenActionError("");
      setDetailsOpen(false);
      setCopyState("idle");
    }, 0);
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const focusables = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("button, a, [tabindex]:not([tabindex='-1'])") ?? []);
        if (!focusables.length) return;
        const first = focusables[0]; const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(resetTimer); window.cancelAnimationFrame(frame); document.removeEventListener("keydown", onKeyDown); };
  }, [onClose, open]);

  if (!open || !markdown) return null;

  const safeSourceDisplayName = sourceDisplayName?.trim() || "本次材料";
  const title = resultTitle?.trim() || buildRunResultTitle({ commandId, task, sourceDisplayName: safeSourceDisplayName });
  const hasDiagnostics = Boolean(runId || taskId || conversationId || skillName || sourceTechnicalName || sourcePath || sourceSha256);

  async function handleOpenInYouNavi() {
    if (!onOpenInYouNavi || openActionState === "loading") return;
    setOpenActionState("loading");
    setOpenActionError("");
    try {
      await onOpenInYouNavi();
      setOpenActionState("success");
    } catch (error) {
      setOpenActionState("error");
      setOpenActionError(String((error as Error)?.message || error).slice(0, 160));
    }
  }

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ runId, taskId, conversationId, skillName, commandId, promptCode, instruction, task, sourceDisplayName: safeSourceDisplayName, sourceTechnicalName, sourcePath, sourceSha256, coverage }, null, 2));
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className={styles.root} data-layout="center">
      <button className={styles.backdrop} type="button" aria-label="关闭结果阅读器" onClick={onClose} />
      <aside ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="run-result-title">
        <header className={styles.header}>
          <div className={styles.heading}><span className={styles.eyebrow}>PERSONA RUN RESULT</span><h2 id="run-result-title">{title}</h2><p><strong>{personaName}视角</strong><span>{promptLabel || promptCode || "分析"}</span></p></div>
          <div className={styles.headerActions}>
            <button className={styles.youNaviAction} type="button" disabled={!onOpenInYouNavi || openActionState === "loading"} aria-label="打开 YouNavi 应用" onClick={() => void handleOpenInYouNavi()}>
              <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M7 5h8v8M15 5 6 14" /><path d="M13 11v4H5V7h4" /></svg>
              <span>{OPEN_ACTION_LABELS[openActionState]}</span>
            </button>
            <button ref={closeRef} className={styles.closeButton} type="button" aria-label="关闭结果阅读器" onClick={onClose}>×</button>
          </div>
        </header>
        {openActionError && <p className={styles.actionError} role="status">{openActionError}</p>}
        <dl className={styles.provenance}>
          <div><dt>数据来源</dt><dd>{safeSourceDisplayName}</dd></div>
          {instruction && <div><dt>执行指令</dt><dd title={instruction}>{instruction}</dd></div>}
          {coverage && <div><dt>阅读覆盖</dt><dd>{coverage}</dd></div>}
        </dl>
        <div className={styles.body}><MarkdownDocument source={markdown} /></div>
        {hasDiagnostics && <details className={styles.diagnostics} open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
          <summary>运行详情</summary>
          {detailsOpen && <div className={styles.diagnosticContent}>
            <dl>
              {sourceTechnicalName && <div><dt>原始文件名</dt><dd>{sourceTechnicalName}</dd></div>}
              {sourcePath && <div><dt>本地路径</dt><dd>{sourcePath}</dd></div>}
              {sourceSha256 && <div><dt>SHA-256</dt><dd>{sourceSha256}</dd></div>}
              {skillName && <div><dt>Skill</dt><dd>{skillName}</dd></div>}
              {runId && <div><dt>runId</dt><dd>{runId}</dd></div>}
              {taskId && <div><dt>taskId</dt><dd>{taskId}</dd></div>}
              {conversationId && <div><dt>conversationId</dt><dd>{conversationId}</dd></div>}
            </dl>
            <button type="button" onClick={() => void copyDiagnostics()}>{copyState === "success" ? "已复制诊断信息" : copyState === "error" ? "复制失败，重试" : "复制诊断信息"}</button>
          </div>}
        </details>}
      </aside>
    </div>
  );
}

function MarkdownDocument({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim(); const code: string[] = []; index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) { code.push(lines[index]); index += 1; }
      index += 1; blocks.push(<pre className={styles.codeBlock} key={`code-${index}`}><code data-language={language || undefined}>{code.join("\n")}</code></pre>); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { const Tag = `h${heading[1].length}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; blocks.push(<Tag key={`heading-${index}`}>{inlineMarkdown(heading[2])}</Tag>); index += 1; continue; }
    if (/^>\s?/.test(line)) { const quote: string[] = []; while (index < lines.length && /^>\s?/.test(lines[index])) { quote.push(lines[index].replace(/^>\s?/, "")); index += 1; } blocks.push(<blockquote key={`quote-${index}`}>{quote.map((item) => <p key={item}>{inlineMarkdown(item)}</p>)}</blockquote>); continue; }
    if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line); const items: string[] = []; while (index < lines.length && (ordered ? /^\d+\.\s+/.test(lines[index]) : /^[-*+]\s+/.test(lines[index]))) { items.push(lines[index].replace(ordered ? /^\d+\.\s+/ : /^[-*+]\s+/, "")); index += 1; }
      const List = ordered ? "ol" : "ul"; blocks.push(<List key={`list-${index}`}>{items.map((item) => <li key={item}>{inlineMarkdown(item)}</li>)}</List>); continue;
    }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const rows: string[][] = []; const split = (value: string) => value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()); rows.push(split(line)); index += 2;
      while (index < lines.length && lines[index].includes("|")) { rows.push(split(lines[index])); index += 1; }
      blocks.push(<table key={`table-${index}`}><thead><tr>{rows[0].map((cell) => <th key={cell}>{inlineMarkdown(cell)}</th>)}</tr></thead><tbody>{rows.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{inlineMarkdown(cell)}</td>)}</tr>)}</tbody></table>); continue;
    }
    const paragraph: string[] = [line]; index += 1; while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s|^```|^>\s?|^[-*+]\s+|^\d+\.\s+/.test(lines[index])) { paragraph.push(lines[index]); index += 1; }
    blocks.push(<p key={`paragraph-${index}`}>{inlineMarkdown(paragraph.join(" "))}</p>);
  }
  return <>{blocks}</>;
}

function inlineMarkdown(value: string): React.ReactNode[] {
  const tokens = value.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.startsWith("`") && token.endsWith("`")) return <code key={index}>{token.slice(1, -1)}</code>;
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={index}>{token.slice(2, -2)}</strong>;
    const link = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return <span key={index}>{token}</span>;
  });
}

export default RunResultSheet;
