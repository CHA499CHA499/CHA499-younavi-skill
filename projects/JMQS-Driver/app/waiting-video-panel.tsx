"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./waiting-video-panel.module.css";

const WAITING_VIDEO_SRC = "/waiting-media/decade-all-riders-waiting-v1.mp4";
const WAITING_RUN_STATUSES = ["pending", "running"] as const;
const TERMINAL_RUN_STATUSES = ["completed", "error", "incomplete", "cancelled"] as const;
const closedRunKeys = new Set<string>();

export type WaitingRunStatus =
  | "idle"
  | "creating"
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "incomplete"
  | "cancelled";

export interface WaitingVideoPanelProps {
  /** The caller's request to show the panel. The component still applies its own safety gates. */
  open: boolean;
  /** Stable identity for one Navi Run. Keep this stable while receipt polling updates. */
  runId?: string;
  /** Only a successful /runs receipt may open the waiting player. */
  receiptAccepted?: boolean;
  /** Pass the current Run status when the caller owns polling. */
  runStatus?: WaitingRunStatus;
  /** Public Sites must pass "public" or omit the component from the tree. */
  runtime?: "local" | "public";
  personaName: string;
  commandCode: string;
  onMinimize: () => void;
  onClose: () => void;
}

export function isWaitingRunStatus(status: WaitingRunStatus | undefined): boolean {
  return status === undefined || WAITING_RUN_STATUSES.includes(status as (typeof WAITING_RUN_STATUSES)[number]);
}

function isLocalRuntime(): boolean {
  return typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function isPublicRuntime(runtime: WaitingVideoPanelProps["runtime"]): boolean {
  return runtime === "public" || !isLocalRuntime();
}

export function shouldRenderWaitingVideoPanel({
  open,
  receiptAccepted = true,
  runStatus,
  runtime,
}: Pick<WaitingVideoPanelProps, "open" | "receiptAccepted" | "runStatus" | "runtime">): boolean {
  if (!open || receiptAccepted === false || !isWaitingRunStatus(runStatus) || isPublicRuntime(runtime)) return false;
  return true;
}

export function WaitingVideoPanel({
  open,
  runId,
  receiptAccepted = true,
  runStatus,
  runtime,
  personaName,
  commandCode,
  onMinimize,
  onClose,
}: WaitingVideoPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [closedRunKey, setClosedRunKey] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [soundPrompt, setSoundPrompt] = useState(false);
  const [playRequired, setPlayRequired] = useState(false);
  const titleId = useId();
  const runKey = runId ?? `legacy:${personaName}:${commandCode}`;
  const safetyGateOpen = shouldRenderWaitingVideoPanel({ open, receiptAccepted, runStatus, runtime });
  const terminalRun = runStatus !== undefined && TERMINAL_RUN_STATUSES.includes(runStatus as (typeof TERMINAL_RUN_STATUSES)[number]);
  const panelOpen = safetyGateOpen && !terminalRun && closedRunKey !== runKey && !closedRunKeys.has(runKey);

  useEffect(() => {
    if (!panelOpen) return;
    const video = videoRef.current;
    if (!video) return;
    const player: HTMLVideoElement = video;
    let disposed = false;

    player.currentTime = 0;
    player.muted = false;
    setMuted(false);
    setSoundPrompt(false);
    setPlayRequired(false);

    async function attemptAutoplay() {
      try {
        await player.play();
      } catch {
        if (disposed) return;
        player.muted = true;
        setMuted(true);
        setSoundPrompt(true);
        try {
          await player.play();
        } catch {
          if (!disposed) setPlayRequired(true);
        }
      }
    }

    void attemptAutoplay();
    return () => {
      disposed = true;
      player.pause();
      player.removeAttribute("src");
      player.load();
    };
  }, [panelOpen, runKey]);

  function handleClose() {
    closedRunKeys.add(runKey);
    setClosedRunKey(runKey);
    onClose();
  }

  function enableSound() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    setSoundPrompt(false);
    setPlayRequired(false);
    void video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      setSoundPrompt(true);
    });
  }

  function playVideo() {
    const video = videoRef.current;
    if (!video) return;
    setPlayRequired(false);
    void video.play().catch(() => setPlayRequired(true));
  }

  if (!panelOpen) return null;

  return (
    <div className={styles.root} role="presentation" data-run-id={runId ?? undefined} data-run-status={runStatus ?? "pending"}>
      <button className={styles.backdrop} type="button" aria-label="最小化等待视频" onClick={onMinimize} />
      <section className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>NAVI RUN · WAITING</span>
            <h2 id={titleId}>正在等待 Navi 结果</h2>
            <p>{personaName} <span aria-hidden="true">·</span> {commandCode}</p>
          </div>
          <div className={styles.actions}>
            <button type="button" aria-label="最小化等待视频" onClick={onMinimize}>↙</button>
            <button type="button" aria-label="关闭等待视频" onClick={handleClose}>×</button>
          </div>
        </header>
        <div className={styles.videoFrame}>
          <video
            ref={videoRef}
            src={WAITING_VIDEO_SRC}
            controls
            playsInline
            loop
            autoPlay
            preload="metadata"
            muted={muted}
            aria-label={`${personaName} ${commandCode} 等待视频`}
          >
            <track kind="captions" src="/waiting-media/waiting-v1.zh-Hans.vtt" srcLang="zh" label="等待提示" />
          </video>
          {playRequired && <button className={styles.playButton} type="button" onClick={playVideo}>播放等待视频</button>}
        </div>
        {(soundPrompt || muted) && <button className={styles.soundButton} type="button" onClick={enableSound}>点击开启声音</button>}
        <footer className={styles.footer}>等待视频只在本地测试运行；关闭不会取消任务，RunStatusCard 仍会保留。</footer>
      </section>
    </div>
  );
}

export default WaitingVideoPanel;
