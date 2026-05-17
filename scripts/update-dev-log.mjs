import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const timeZone = "Asia/Shanghai";
const logDir = resolve("development-logs");
const planPath = resolve("docs/development/v0.1-implementation-plan.md");
const autoStart = "<!-- AUTO:START -->";
const autoEnd = "<!-- AUTO:END -->";

function runGit(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function formatDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function readPlanProgress() {
  if (!existsSync(planPath)) {
    return {
      completed: [],
      open: ["docs/development/v0.1-implementation-plan.md not found"],
    };
  }

  const plan = readFileSync(planPath, "utf8");
  const completed = [];
  const open = [];

  plan.split(/\r?\n/).forEach((line) => {
    const checked = line.match(/^- \[[xX]\]\s+\*\*(.+?)\*\*/);
    const unchecked = line.match(/^- \[ \]\s+\*\*(.+?)\*\*/);

    if (checked) completed.push(checked[1]);
    if (unchecked) open.push(unchecked[1]);
  });

  return { completed, open };
}

function listOrPlaceholder(items, placeholder, limit = 12) {
  const visibleItems = items.slice(0, limit);

  if (visibleItems.length === 0) {
    return `- ${placeholder}`;
  }

  const suffix =
    items.length > limit ? [`- ...and ${items.length - limit} more item(s)`] : [];

  return [...visibleItems.map((item) => `- ${item}`), ...suffix].join("\n");
}

function buildAutoSection(now) {
  const { date, time } = formatDateParts(now);
  const gitStatus = runGit(["status", "--short"]);
  const commitsToday = runGit([
    "log",
    `--since=${date} 00:00:00 +0800`,
    "--pretty=format:%h %s",
  ]);
  const { completed, open } = readPlanProgress();

  return `${autoStart}
## Auto Snapshot

Generated at ${date} ${time} CST (+0800).

### Git Status
${gitStatus ? gitStatus.split(/\r?\n/).map((line) => `- \`${line}\``).join("\n") : "- Working tree has no tracked changes"}

### Commits Today
${commitsToday ? commitsToday.split(/\r?\n/).map((line) => `- ${line}`).join("\n") : "- No commits recorded today"}

### Completed Plan Steps
${listOrPlaceholder(completed, "No checked plan steps yet")}

### Open Plan Steps
${listOrPlaceholder(open, "No open plan steps found")}

### Verification Reminder
- Run \`pnpm verify:answer\` before marking a development slice complete.
${autoEnd}`;
}

function createInitialLog(date) {
  return `# Development Log - ${date}

## Manual Completed Items

- Add completed development work here during the day.

## Manual Todo Items

- Add follow-up development work here during the day.

## Notes and Risks

- Record blockers, product questions, and verification notes here.

`;
}

function updateLog() {
  const now = new Date();
  const { date } = formatDateParts(now);
  const logPath = resolve(logDir, `${date}.md`);
  const autoSection = buildAutoSection(now);

  mkdirSync(logDir, { recursive: true });

  const existing = existsSync(logPath) ? readFileSync(logPath, "utf8") : createInitialLog(date);
  const next = existing.includes(autoStart) && existing.includes(autoEnd)
    ? existing.replace(new RegExp(`${autoStart}[\\s\\S]*?${autoEnd}`), autoSection)
    : `${existing.trimEnd()}\n\n${autoSection}\n`;

  writeFileSync(logPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
  console.log(`development log updated: ${logPath}`);
}

try {
  updateLog();
} catch (error) {
  console.error("development log update failed");
  console.error(error);
  process.exit(1);
}
