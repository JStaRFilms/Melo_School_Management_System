"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null;
  onScoreChange: (value: number | null) => void;
};

/** Keep in-progress decimal text separate from the persisted score draft. */
export function ScoreNumberInput({ value, onScoreChange, onBlur, ...props }: Props) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  const commit = (text: string) => {
    if (/^-?\d+(?:\.\d{1,2})?$/.test(text)) {
      const number = Number(text);
      if (Number.isFinite(number) && number !== value) onScoreChange(number);
    }
  };
  return <input {...props} type="text" inputMode="decimal" value={editing ? raw : value ?? ""}
    onFocus={() => { setRaw(value === null ? "" : String(value)); setEditing(true); }}
    onChange={(event) => {
      const text = event.target.value;
      setRaw(text);
      setEditing(true);
      // A blank or trailing decimal point is a typing state, not a cleared score.
      if (text !== "") commit(text);
    }}
    onBlur={(event) => {
      if (raw === "" && value !== null) onScoreChange(null);
      else commit(raw);
      setEditing(false);
      onBlur?.(event);
    }} />;
}
