// Pure logic for ForesightCard: reads the deck contract (foresight-deck/v1) and
// builds the foresight-play/v1 payload. No React here, so it is unit-tested in node.
import raw from "./deck.json";

export type Step =
  | { id: string; type: "text" | "long"; label: string; help?: string }
  | { id: string; type: "list"; n: number; label: string; help?: string }
  | { id: string; type: "scale"; label: string; help?: string }
  | { id: string; type: "choice"; options: string[]; label: string; help?: string };

export type DeckCard = {
  id: string; name: string; suit: string; glyph: string; xp: number; page: number | null;
  requires: string[]; produces: string; pitch: string; steps: Step[];
  tip?: string; flag?: string; task: string;
};

export type Deck = {
  schema: "foresight-deck/v1"; version: string;
  suits: Record<string, string>; types: Record<string, string>;
  scale4: { v: number; l: string }[]; cards: DeckCard[];
};

export const deck = raw as unknown as Deck;
export const CARD_IDS = deck.cards.map((c) => c.id) as [string, ...string[]];

/** Deck glyph → Lucide icon name (checked against lucide-react 0.562.0). */
export const ICON: Record<string, string> = {
  origin: "compass", context: "flower", curve: "trending-up", cones: "hourglass", arcs: "users",
  persona: "user-round", stage: "drama", spots: "crosshair", vision: "target", mockup: "file",
  darpa: "rocket", path: "route", clover: "clover", star: "star", buddies: "handshake", seal: "badge-check",
};

export type Value = string | string[];
export type Values = Record<string, Value | undefined>;

export function getCard(id: string): DeckCard | undefined {
  return deck.cards.find((c) => c.id === id);
}

export function isFilled(step: Step, v: Value | undefined): boolean {
  if (step.type === "list") return Array.isArray(v) && v.length === step.n && v.every((x) => x.trim() !== "");
  return typeof v === "string" && v.trim() !== "";
}

export function isComplete(card: DeckCard, values: Values): boolean {
  return card.steps.every((s) => isFilled(s, values[s.id]));
}

/** Input types the card needs that are not in `have`. Without `have`, nothing is locked. */
export function missingInputs(card: DeckCard, have?: string[]): string[] {
  if (!have) return [];
  return card.requires.filter((t) => !have.includes(t));
}

export type Play = {
  schema: "foresight-play/v1";
  deck: string;
  card: string;
  produces: string;
  data: Record<string, string | number | string[]>;
};

/** Same shape the Baralho page and compile.mjs send. Scale answers become numbers 0–3. */
export function buildPlay(card: DeckCard, values: Values): Play {
  const data: Play["data"] = {};
  for (const s of card.steps) {
    const v = values[s.id];
    if (s.type === "scale") data[s.id] = Number(v);
    else if (s.type === "list") data[s.id] = Array.isArray(v) ? v.map((x) => x.trim()) : [];
    else data[s.id] = typeof v === "string" ? v.trim() : "";
  }
  return { schema: "foresight-play/v1", deck: `${deck.schema}@${deck.version}`, card: card.id, produces: card.produces, data };
}
