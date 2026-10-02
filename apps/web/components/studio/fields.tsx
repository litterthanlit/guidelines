"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Local draft state that follows the external value unless the user is mid-edit. */
export function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  return {
    draft,
    setDraft,
    bind: {
      onFocus: () => (focused.current = true),
      onBlurCapture: () => (focused.current = false),
    },
  };
}

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: (id: string) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fid} className="text-[12px] font-medium text-ink-2">
        {label}
      </label>
      {children(fid)}
      {hint && <p className="text-[11.5px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onCommit,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const { draft, setDraft, bind } = useDraft(value);
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          className="field"
          value={draft}
          placeholder={placeholder}
          {...bind}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== value && onCommit(draft)}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        />
      )}
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onCommit,
  placeholder,
  hint,
  rows = 4,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
}) {
  const { draft, setDraft, bind } = useDraft(value);
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <textarea
          id={id}
          rows={rows}
          className="field"
          value={draft}
          placeholder={placeholder}
          {...bind}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== value && onCommit(draft)}
        />
      )}
    </Field>
  );
}

export function Segmented({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-ink-2">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex w-fit gap-0.5 rounded-full bg-sunken p-0.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={`rounded-full px-3 py-1 text-[12px] capitalize transition ${value === o ? "bg-surface font-medium shadow-float" : "text-ink-2 hover:text-ink"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-5 last:border-b-0">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="label">{title}</h3>
        {action}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
