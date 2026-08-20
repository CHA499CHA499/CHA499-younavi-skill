const COMMAND_TITLE_VERBS = Object.freeze({
  review: "评审",
  explain: "解释",
  decision: "决策",
  action: "制定",
});

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function quoteTarget(value) {
  const target = cleanText(value).replace(/^《|》$/g, "").replace(/[。；;]+$/g, "").slice(0, 72);
  return target ? `《${target}》` : "";
}

export function humanizeSourceDisplayName(value, fallback = "本次材料") {
  const technicalName = cleanText(value);
  if (!technicalName) return fallback;
  const withoutExtension = technicalName.replace(/\.(md|txt)$/i, "");
  return withoutExtension
    .replace(/[_-]+/g, " ")
    .replace(/\bInterview\b/gi, "访谈")
    .replace(/原转写|转写文本/g, "原文")
    .replace(/\s+/g, " ")
    .trim() || fallback;
}

export function buildRunResultTitle({ commandId, task, sourceDisplayName } = {}) {
  const normalizedTask = cleanText(task);
  const quoted = normalizedTask.match(/《([^》]{1,120})》/)?.[1];
  const fallbackTarget = quoteTarget(sourceDisplayName || "本次任务");
  if (commandId === "custom") {
    return normalizedTask ? `自定义分析：${normalizedTask.slice(0, 80)}` : `自定义分析${fallbackTarget}`;
  }
  const verb = COMMAND_TITLE_VERBS[commandId] || "分析";
  let target = quoted ? quoteTarget(quoted) : "";
  if (!target && normalizedTask) {
    const stripped = normalizedTask
      .replace(/^(请)?(评审|解释|决策|制定|分析)\s*/u, "")
      .replace(/^基于(所选素材)?\s*/u, "")
      .replace(/(中的观点、成立条件、风险和需补证部分|的背景、关键概念、因果链和历史逻辑|比较方案、代价和不可逆风险并给出建议|提炼行动、负责人、验收标准与风险)[。.]?$/u, "")
      .trim();
    if (stripped && stripped.length <= 72) target = quoteTarget(stripped);
  }
  if (!target) target = fallbackTarget;
  return commandId === "action" ? `${verb}${target}行动方案` : `${verb}${target}`;
}
