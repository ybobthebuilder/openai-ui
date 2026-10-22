import { createParser, type LibrarySpec } from "@openuidev/lang-core";
import { describe, expect, it } from "vitest";
import spec from "@/generated/spec.json";
import { CARD_IDS, ICON, buildPlay, deck, getCard, isComplete, missingInputs } from "./play";

const library = spec as LibrarySpec;
const parser = createParser(library.schema!, library.root);
const parse = (code: string) => {
  const r = parser.parse(code);
  return { root: r.root !== null, errors: r.meta.errors.map((e) => e.message), unresolved: r.meta.unresolved, orphaned: r.meta.orphaned };
};

describe("ForesightCard in the generated spec", () => {
  it("is registered (run npm run generate after changes)", () => {
    const entry = (library.components as Record<string, { signature: string }>)["ForesightCard"];
    expect(entry, "ForesightCard missing from spec.json").toBeDefined();
    for (const id of CARD_IDS) expect(entry.signature).toContain(`"${id}"`);
  });

  it("parses a program that places a card", () => {
    expect(parse(`root = Col([intro, card])\nintro = Text("Próxima carta:")\ncard = ForesightCard("darpa", ["vision"])`))
      .toEqual({ root: true, errors: [], unresolved: [], orphaned: [] });
  });
});

describe("deck contract", () => {
  it("has an icon for every glyph", () => {
    for (const c of deck.cards) expect(ICON[c.glyph], c.glyph).toBeTruthy();
  });

  it("locks a card only when `have` is given and lacks an input", () => {
    const vision = getCard("vision")!;
    expect(missingInputs(vision)).toEqual([]);
    expect(missingInputs(vision, ["matrix"])).toEqual(["persona"]);
    expect(missingInputs(vision, ["matrix", "persona"])).toEqual([]);
  });

  it("builds foresight-play/v1 with every step, scales as numbers", () => {
    const darpa = getCard("darpa")!;
    const values = { far: "3", tech: "2", multi: "1", act: "0", gap: "  falta hardware  " };
    expect(isComplete(darpa, values)).toBe(true);
    expect(isComplete(darpa, { ...values, act: undefined })).toBe(false);
    expect(buildPlay(darpa, values)).toEqual({
      schema: "foresight-play/v1", deck: `foresight-deck/v1@${deck.version}`, card: "darpa", produces: "darpa",
      data: { far: 3, tech: 2, multi: 1, act: 0, gap: "falta hardware" },
    });
  });

  it("requires every list item", () => {
    const origem = getCard("origem")!;
    expect(isComplete(origem, { start: "Externo", topic: "x", sources: ["a", "b", ""] })).toBe(false);
    expect(isComplete(origem, { start: "Externo", topic: "x", sources: ["a", "b", "c"] })).toBe(true);
  });
});
