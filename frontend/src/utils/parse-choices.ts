/**
 * The ```choices block an agent ends a message with when it wants the user to pick
 * (the instruction is in jentic/AGENTS.md.tmpl). Two accepted shapes:
 *
 *   {"question": "…", "multiSelect": false, "options": [{"label": "…", "description": "…"}, …]}
 *   {"questions": [ <the same>, … ]}
 *
 * Options may also be bare strings. Anything that does not parse into 1–4 questions of
 * 2–6 options returns null, and the block renders as the code it is.
 */
export interface ChoiceOption {
  label: string;
  description?: string;
}

export interface ChoiceQuestion {
  question: string;
  multiSelect: boolean;
  options: ChoiceOption[];
}

const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

function option(v: unknown): ChoiceOption | null {
  if (typeof v === "string") return text(v) ? { label: v.trim() } : null;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const label = text(o.label) ?? text(o.title) ?? text(o.name);
  if (!label) return null;
  const description = text(o.description) ?? text(o.detail) ?? undefined;
  return description ? { label, description } : { label };
}

function question(v: unknown): ChoiceQuestion | null {
  if (!v || typeof v !== "object") return null;
  const q = v as Record<string, unknown>;
  const title = text(q.question) ?? text(q.header) ?? text(q.title);
  if (!title || !Array.isArray(q.options)) return null;
  const options = q.options.map(option);
  if (options.some((o) => !o) || options.length < 2 || options.length > 6) return null;
  return {
    question: title,
    multiSelect: q.multiSelect === true || q.multi_select === true,
    options: options as ChoiceOption[],
  };
}

export function parseChoices(raw: string): ChoiceQuestion[] | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const list =
    data && typeof data === "object" && Array.isArray((data as { questions?: unknown }).questions)
      ? (data as { questions: unknown[] }).questions
      : Array.isArray(data)
        ? data
        : [data];
  if (list.length < 1 || list.length > 4) return null;
  const qs = list.map(question);
  return qs.some((q) => !q) ? null : (qs as ChoiceQuestion[]);
}

/** The reply sent for the user's picks: one line per question, in the agent's own words. */
export function formatAnswer(questions: ChoiceQuestion[], picks: string[][]): string {
  if (questions.length === 1) {
    const p = picks[0];
    return p.length === 1 ? `My choice: ${p[0]}` : `My choices: ${p.join("; ")}`;
  }
  return questions.map((q, i) => `${q.question} → ${picks[i].join("; ")}`).join("\n");
}

const BULLET = /^\s*(?:[-*•]|[a-fA-F][.)]|\(?[a-fA-F]\))\s+(.*\S)\s*$/;
const clean = (s: string) =>
  s.replace(/\*\*|__|`/g, "").replace(/^\s*\d+[.)]\s*/, "").replace(/\s+/g, " ").trim();

/**
 * Options the agent wrote as prose rather than as a ```choices block: a line with a question
 * mark, then 2–6 bullets (-, *, •, a) b)). Models asked to "ask clarifying questions" do this
 * whatever their instructions say (gpt-oss-120b, 2026-09-23). A bullet list that does not
 * follow a question is a summary, not a choice, and is left alone.
 */
export function inferChoices(markdown: string): ChoiceQuestion[] | null {
  if (/```choices/.test(markdown)) return null;
  const lines = markdown.split("\n");
  const found: ChoiceQuestion[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes("?") || BULLET.test(lines[i])) continue;
    const opts: ChoiceOption[] = [];
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j += 1;
    for (; j < lines.length; j += 1) {
      const m = BULLET.exec(lines[j]);
      if (!m) break;
      const body = clean(m[1]);
      const split = /^(.{2,80}?)\s+[–—-]\s+(.+)$/.exec(body);
      opts.push(split ? { label: split[1], description: split[2] } : { label: body });
    }
    if (opts.length >= 2 && opts.length <= 6) {
      found.push({ question: clean(lines[i]), multiSelect: false, options: opts });
      i = j - 1;
    }
  }
  return found.length >= 1 && found.length <= 4 ? found : null;
}
