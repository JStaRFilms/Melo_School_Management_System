"use client";

import { useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null;
  onScoreChange: (value: number | null) => void;
};

/** Keep in-progress decimal text separate from the persisted score draft. */
export function ScoreNumberInput({ value, onScoreChange, onBlur, ...props }: Props) {
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [raw, setRaw] = useState("");
  const previousValue = useRef(value);
  const lastEmitted = useRef<number | null>(value);
  const conflictId = useId();

  useLayoutEffect(() => {
    if (Object.is(value, previousValue.current)) return;
    previousValue.current = value;
    if (editing && dirty && !Object.is(value, lastEmitted.current)) {
      setConflict(true);
    } else if (editing && !dirty && !conflict) {
      setRaw(value === null ? "" : String(value));
    }
  }, [value, editing, dirty, conflict]);

  const parsed = (text: string) => {
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  };
  const commit = (text: string, force = false) => {
    const number = parsed(text);
    if (number !== null && number !== value && (force || number !== lastEmitted.current)) {
      lastEmitted.current = number;
      onScoreChange(number);
    }
  };
  const useLatest = () => {
    setConflict(false);
    setDirty(false);
    setEditing(false);
    setRaw(value === null ? "" : String(value));
    lastEmitted.current = value;
  };

  return <>
    <input {...props} type="text" inputMode="decimal" value={editing || conflict ? raw : value ?? ""}
      aria-invalid={conflict || props["aria-invalid"]}
      aria-describedby={[props["aria-describedby"], conflict ? conflictId : null].filter(Boolean).join(" ") || undefined}
      onFocus={() => {
        if (!conflict) {
          setRaw(value === null ? "" : String(value));
          setDirty(false);
          lastEmitted.current = value;
        }
        setEditing(true);
      }}
      onChange={(event) => {
        const text = event.target.value;
        setRaw(text);
        setEditing(true);
        setDirty(true);
        // A blank or trailing decimal point is a typing state, not a cleared score.
        if (!conflict && text !== "") commit(text);
      }}
      onBlur={(event) => {
        if (!conflict) {
          if (raw === "" && value !== null) {
            lastEmitted.current = null;
            onScoreChange(null);
          } else commit(raw);
          setDirty(false);
        }
        setEditing(false);
        onBlur?.(event);
      }} />
    {conflict && <span className="text-xs text-amber-800" role="alert" id={conflictId}>
      Score changed elsewhere to {value ?? "blank"}. Review your entry before replacing it.
      <button type="button" disabled={props.disabled || (raw !== "" && parsed(raw) === null)}
        onClick={() => {
          if (raw === "") {
            if (value !== null) onScoreChange(null);
          } else commit(raw, true);
          useLatest();
          lastEmitted.current = raw === "" ? null : parsed(raw);
        }}>Use my score</button>
      <button type="button" disabled={props.disabled} onClick={useLatest}>Use latest score</button>
    </span>}
  </>;
}
