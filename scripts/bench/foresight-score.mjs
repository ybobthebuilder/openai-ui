// Scores one answer program against one foresight eval case. Pure: no network, no fs.
// A case says which artifact types exist (have) and which cards were played; the
// answer must place only cards whose needs are met, pass the right `have`, and
// never rebuild a card with Input/Form. A case with expect "none" must place no card.

const CARD_CALL = /ForesightCard\(\s*"([^"]+)"\s*(?:,\s*(\[[^\]]*\]|[^)\s,]+))?/g;

/** Every ForesightCard(...) in the program, with its literal `have` list (null if not a literal list). */
export function extractCards(program) {
  return [...program.matchAll(CARD_CALL)].map((m) => {
    const arg = m[2];
    const have = arg === undefined ? [] : arg.startsWith("[") ? [...arg.matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
    return { id: m[1], have };
  });
}

/** Cards not yet played whose needs are all in `have`. */
export function unlocked(deck, have, played = []) {
  return deck.cards.filter((c) => !played.includes(c.id) && c.requires.every((t) => have.includes(t))).map((c) => c.id);
}

export function score(program, kase, deck, parser) {
  const checks = [];
  const add = (name, ok, detail = "") => checks.push({ name, ok, detail });
  const r = parser.parse(program);
  const problems = [...r.meta.errors.map((e) => e.message), ...r.meta.unresolved.map((u) => `unresolved ${u}`)];
  add("parses with the 1.0 parser", r.root !== null && problems.length === 0, problems.slice(0, 3).join("; "));

  const cards = extractCards(program);
  if (kase.expect === "none") {
    add("places no ForesightCard", cards.length === 0, cards.map((c) => c.id).join(", "));
  } else {
    const allowed = unlocked(deck, kase.have, kase.played);
    const byId = Object.fromEntries(deck.cards.map((c) => [c.id, c]));
    add("places at least one ForesightCard", cards.length > 0);
    add("places at most two cards", cards.length <= 2, String(cards.length));
    const wrong = cards.filter((c) => !allowed.includes(c.id)).map((c) => c.id);
    add("every card is unlocked and not yet played", wrong.length === 0, wrong.length ? `${wrong.join(", ")} (allowed: ${allowed.join(", ")})` : "");
    const badHave = cards.filter((c) => c.have === null || !kase.have.every((t) => c.have.includes(t)) || c.have.some((t) => !kase.have.includes(t)));
    add("have equals the artifacts made so far", badHave.length === 0,
      badHave.map((c) => `${c.id}: ${c.have === null ? "not a literal list" : JSON.stringify(c.have)} ≠ ${JSON.stringify(kase.have)}`).join("; "));
    const locked = cards.filter((c) => byId[c.id] && c.have && !byId[c.id].requires.every((t) => c.have.includes(t))).map((c) => c.id);
    add("no card renders locked", locked.length === 0, locked.join(", "));
    // Heuristic: the rule forbids rebuilding a card's fields by hand next to the card.
    const rebuilt = /\b(Form|Input|TextArea)\(/.test(program);
    add("does not rebuild fields with Form/Input/TextArea", !rebuilt);
  }
  return { id: kase.id, pass: checks.every((c) => c.ok), checks, cards };
}
