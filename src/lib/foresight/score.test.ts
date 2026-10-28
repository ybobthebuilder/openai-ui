import { createParser, type LibrarySpec } from "@openuidev/lang-core";
import { describe, expect, it } from "vitest";
import spec from "@/generated/spec.json";
import cases from "../../../scripts/bench/foresight-cases.json";
import { extractCards, score, unlocked } from "../../../scripts/bench/foresight-score.mjs";
import { deck } from "./play";

const library = spec as LibrarySpec;
const parser = createParser(library.schema!, library.root);
type Case = { id: string; have: string[]; played: string[]; expect: "next" | "none" };
const byId = Object.fromEntries((cases as Case[]).map((c) => [c.id, c]));
const failed = (r: { checks: { name: string; ok: boolean }[] }) => r.checks.filter((c) => !c.ok).map((c) => c.name);

describe("foresight eval scorer", () => {
  it("knows what each case unlocks", () => {
    expect(unlocked(deck, [], [])).toEqual(["origem"]);
    expect(unlocked(deck, ["topic"], ["origem"])).toEqual(["context-map", "progression", "arcs", "crowd-clovers"]);
  });

  it("reads card ids and literal have lists", () => {
    expect(extractCards(`a = ForesightCard("vision", ["matrix", "persona"])\nb = ForesightCard("origem")\nc = ForesightCard("darpa", $h)`))
      .toEqual([{ id: "vision", have: ["matrix", "persona"] }, { id: "origem", have: [] }, { id: "darpa", have: null }]);
  });

  it("passes a correct first answer", () => {
    const good = `root = Col([t, c])\nt = Title("Avaliar o cenário", "lg")\nc = ForesightCard("origem", [])`;
    const r = score(good, byId["f-start-pt"], deck, parser);
    expect(failed(r)).toEqual([]);
  });

  it("passes a correct answer after the topic", () => {
    const good = `root = Col([t, Grid([a, b], 2, 280, 4)])\nt = Title("Próximas cartas", "lg")\na = ForesightCard("context-map", ["topic"])\nb = ForesightCard("progression", ["topic"])`;
    expect(failed(score(good, byId["f-after-topic"], deck, parser))).toEqual([]);
  });

  it("fails a locked card, a wrong have and a hand-built form", () => {
    const bad = `root = Col([a, f])\na = ForesightCard("vision", [])\n$x = ""\nf = Form([Input($x, "Tema"), Button("Enviar", @ToAssistant("Enviar"))])`;
    expect(failed(score(bad, byId["f-after-topic"], deck, parser))).toEqual([
      "every card is unlocked and not yet played",
      "have equals the artifacts made so far",
      "no card renders locked",
      "does not rebuild fields with Form/Input/TextArea",
    ]);
  });

  it("fails a card where none belongs, and a program that does not parse", () => {
    expect(failed(score(`root = Col([ForesightCard("origem", [])])`, byId["f-negative"], deck, parser))).toEqual(["places no ForesightCard"]);
    expect(failed(score(`root = Col([Titulo("x")])`, byId["f-negative"], deck, parser))).toEqual(["parses with the 1.0 parser"]);
  });
});
