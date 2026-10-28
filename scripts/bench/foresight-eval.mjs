// Foresight eval: sends each case in foresight-cases.json through the app's own /api/chat
// (so it uses whatever backend .env selects: Thesys Gateway, OpenRouter or Ollama), keeps
// the answer, and scores it with foresight-score.mjs. Exit code 1 if any case fails.
//
//   npm run dev                          # in another terminal
//   npm run eval:foresight               # all cases against http://localhost:3000
//   npm run eval:foresight -- --only f-start-pt --runs 3
//   npm run eval:foresight -- --answers bench-out/foresight-<time>/answers   # re-score saved answers, no model
//
// The API key stays in the app's server; this script never reads it.
import { buildMessage, createParser } from "@openuidev/lang-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { score } from "./foresight-score.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { values: opt } = parseArgs({
  options: {
    app: { type: "string", default: "http://localhost:3000" },
    only: { type: "string" },
    runs: { type: "string", default: "1" },
    answers: { type: "string" },
    out: { type: "string" },
  },
});

const read = (p) => JSON.parse(readFileSync(path.join(root, p), "utf8"));
const deck = read("src/lib/foresight/deck.json");
const spec = read("src/generated/spec.json");
const parser = createParser(spec.schema, spec.root);
let cases = read("scripts/bench/foresight-cases.json");
if (opt.only) cases = cases.filter((c) => opt.only.split(",").includes(c.id));
const runs = Math.max(1, Number(opt.runs) || 1);

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = path.resolve(opt.out ?? path.join(root, "bench-out", `foresight-${stamp}`));
mkdirSync(path.join(out, "answers"), { recursive: true });

/** The program in a reply: the first fenced block if there is one, else the whole text (as run.mjs does). */
function extractProgram(text) {
  const fence = /```[\w-]*\n([\s\S]*?)```/.exec(text);
  return (fence ? fence[1] : text).trim();
}

/** One case through /api/chat; returns the assistant text from the SSE stream. */
async function ask(kase) {
  const messages = kase.turns.map((t) => ({ role: t.role, content: t.context ? buildMessage({ content: t.content, context: t.context }) : t.content }));
  const origin = new URL(opt.app).origin;
  const res = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  let text = "", done = null;
  for (const line of (await res.text()).split("\n")) {
    if (!line.startsWith("data: ")) continue;
    let ev;
    try { ev = JSON.parse(line.slice(6)); } catch { continue; }
    if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
    if (ev.type === "response.output_text.done") done = ev.text ?? null;
    if (ev.type === "error") throw new Error(ev.message ?? "stream error");
  }
  return done ?? text;
}

const results = [];
for (const kase of cases) {
  for (let run = 1; run <= runs; run++) {
    const name = runs > 1 ? `${kase.id}.${run}` : kase.id;
    try {
      const program = opt.answers
        ? readFileSync(path.join(path.resolve(opt.answers), `${name}.oui`), "utf8")
        : extractProgram(await ask(kase));
      writeFileSync(path.join(out, "answers", `${name}.oui`), program);
      const r = { ...score(program, kase, deck, parser), run };
      results.push(r);
      console.log(`${r.pass ? "PASS" : "FAIL"} ${name}  cards: [${r.cards.map((c) => c.id).join(", ")}]`);
      for (const c of r.checks.filter((c) => !c.ok)) console.log(`     ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    } catch (err) {
      results.push({ id: kase.id, run, pass: false, error: err instanceof Error ? err.message : String(err), checks: [] });
      console.log(`ERROR ${name}: ${results.at(-1).error}`);
    }
  }
}

const passed = results.filter((r) => r.pass).length;
const summary = { date: new Date().toISOString(), app: opt.answers ? null : opt.app, answers: opt.answers ?? null, deck: `${deck.schema}@${deck.version}`, runs, total: results.length, passed };
writeFileSync(path.join(out, "report.json"), JSON.stringify({ summary, results }, null, 2));
writeFileSync(path.join(out, "report.md"), [
  `# Foresight eval`, "", `${summary.date}. ${passed}/${results.length} passed. Deck ${summary.deck}.`, "",
  "| case | run | result | cards | failed checks |", "|---|---|---|---|---|",
  ...results.map((r) => `| ${r.id} | ${r.run} | ${r.error ? "error" : r.pass ? "pass" : "fail"} | ${(r.cards ?? []).map((c) => c.id).join(", ")} | ${(r.error ?? r.checks.filter((c) => !c.ok).map((c) => c.name).join("; ")).replaceAll("|", "\\|")} |`),
  "",
].join("\n"));
console.log(`\n${passed}/${results.length} passed → ${path.join(out, "report.md")}`);
process.exit(passed === results.length ? 0 : 1);
