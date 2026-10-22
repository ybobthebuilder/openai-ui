"use client";

import { defineComponent, useFormName, useIsStreaming, useTriggerAction, type ActionPlan } from "@openuidev/react-lang";
import { useState } from "react";
import { z } from "zod/v4";
import { CARD_IDS, ICON, buildPlay, deck, getCard, isComplete, isFilled, missingInputs, type Step, type Value, type Values } from "../foresight/play";
import { Glyph } from "./glyph";

function StepField({ step, n, value, onChange, disabled }: { step: Step; n: number; value: Value | undefined; onChange: (v: Value) => void; disabled: boolean }) {
  const label = `${n}. ${step.label}`;
  const done = isFilled(step, value);
  const head = (
    <span className="iui-label">
      {done ? "✓ " : ""}{label}
      {step.help ? <span className="iui-caption" style={{ display: "block" }}>{step.help}</span> : null}
    </span>
  );
  if (step.type === "list") {
    const items = Array.from({ length: step.n }, (_, i) => (Array.isArray(value) ? value[i] ?? "" : ""));
    return (
      <div className="iui-field">
        {head}
        {items.map((v, i) => (
          <input key={i} className="iui-input" type="text" value={v} disabled={disabled} aria-label={`${label} ${i + 1}`}
            onChange={(e) => { const next = [...items]; next[i] = e.target.value; onChange(next); }} />
        ))}
      </div>
    );
  }
  if (step.type === "scale" || step.type === "choice") {
    const options = step.type === "scale"
      ? deck.scale4.map((o) => ({ value: String(o.v), label: `${o.v} · ${o.l}` }))
      : step.options.map((o) => ({ value: o, label: o }));
    return (
      <div className="iui-field">
        {head}
        <div className="iui-segmented iui-block" role="radiogroup" aria-label={label}>
          {options.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={o.value === value} disabled={disabled}
              className={o.value === value ? "is-selected" : undefined} onClick={() => onChange(o.value)}>{o.label}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label className="iui-field">
      {head}
      {step.type === "long"
        ? <textarea className="iui-textarea" rows={5} value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        : <input className="iui-input" type="text" value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

export const ForesightCard = defineComponent({
  name: "ForesightCard",
  props: z.object({
    card: z.enum(CARD_IDS),
    have: z.array(z.string()).optional(),
  }),
  description: "A playable foresight method card. card is its id. have lists the artifact types the user already produced; a missing input locks the card. The card renders its own fields and sends the answers with its submit; never rebuild those fields by hand.",
  component: function ForesightCardView({ props }) {
    const card = getCard(String(props.card));
    const trigger = useTriggerAction();
    const formName = useFormName();
    const streaming = useIsStreaming();
    const [values, setValues] = useState<Values>({});
    if (!card) return null;
    const missing = missingInputs(card, props.have);
    const locked = missing.length > 0;
    const done = card.steps.filter((s) => isFilled(s, values[s.id])).length;
    const ready = !locked && isComplete(card, values);
    const play = () => {
      const payload = buildPlay(card, values);
      const message = `Jogar ${card.name}`;
      const plan: ActionPlan = { steps: [{ type: "continue_conversation", message, context: payload }] };
      void trigger(message, formName, plan);
    };
    return (
      <div className="iui-card" data-foresight-card={card.id} style={{ padding: 20, gap: 14, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Glyph name={ICON[card.glyph] ?? "square"} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{card.name}</div>
            <div className="iui-caption">{deck.suits[card.suit]} · +{card.xp} XP{card.page ? ` · playbook p. ${card.page}` : ""}</div>
          </div>
          <span className="iui-badge iui-badge-info">gera {deck.types[card.produces]}</span>
        </div>
        <div>{card.pitch}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span className="iui-caption">usa</span>
          {card.requires.length === 0
            ? <span className="iui-badge iui-badge-neutral">nada</span>
            : card.requires.map((t) => (
              <span key={t} className={`iui-badge ${missing.includes(t) ? "iui-badge-warning" : "iui-badge-success"}`}>{deck.types[t]}</span>
            ))}
        </div>
        {locked ? <div className="iui-caption" style={{ color: "var(--iui-danger)" }}>Bloqueada: falta {missing.map((t) => deck.types[t]).join(", ")}.</div> : null}
        {card.flag ? <div className="iui-caption" style={{ color: "var(--iui-danger)" }}>{card.flag}</div> : null}
        {card.steps.map((s, i) => (
          <StepField key={s.id} step={s} n={i + 1} value={values[s.id]} disabled={locked}
            onChange={(v) => setValues((prev) => ({ ...prev, [s.id]: v }))} />
        ))}
        {card.tip ? <div className="iui-caption">{card.tip}</div> : null}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="iui-button iui-button-solid iui-button-md" disabled={!ready || streaming} onClick={play}>
            Jogar carta · +{card.xp} XP
          </button>
          <span className="iui-caption">{done}/{card.steps.length} etapas</span>
        </div>
      </div>
    );
  },
});
