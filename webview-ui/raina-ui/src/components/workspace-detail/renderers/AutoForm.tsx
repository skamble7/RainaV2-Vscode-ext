// src/components/workspace-detail/artifact/renderers/AutoForm.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getHint, preferredOrder } from "../artifact/hints";
import type { Hint } from "../artifact/hints";

type Props = {
  kind: string;
  value: any; // artifact.data
  onChangeAt: (mutator: (root: any) => void) => void; // mutate draft root in place
};

export default function AutoForm({ kind, value, onChangeAt }: Props) {
  return (
    <div className="space-y-3">
      <ObjectEditor kind={kind} path={[]} value={value} onChangeAt={onChangeAt} />
    </div>
  );
}

/* ---------------- core editors ---------------- */

function ObjectEditor({
  kind,
  path,
  value,
  onChangeAt,
}: {
  kind: string;
  path: (string | number)[];
  value: any;
  onChangeAt: Props["onChangeAt"];
}) {
  if (value === null || value === undefined)
    return <EmptyValue path={path} onChangeAt={onChangeAt} />;

  const t = typeof value;
  if (t !== "object")
    return (
      <PrimitiveEditor kind={kind} path={path} value={value} onChangeAt={onChangeAt} />
    );

  if (Array.isArray(value))
    return (
      <ArrayEditor kind={kind} path={path} value={value} onChangeAt={onChangeAt} />
    );

  // object
  const keys = Object.keys(value).sort(preferOrderByKind(kind));
  return (
    <div className="space-y-3">
      {keys.map((k) => (
        <Field key={String(k)} label={labelize(k)}>
          <ObjectEditor
            kind={kind}
            path={[...path, k]}
            value={value[k]}
            onChangeAt={onChangeAt}
          />
        </Field>
      ))}
    </div>
  );
}

function ArrayEditor({
  kind,
  path,
  value,
  onChangeAt,
}: {
  kind: string;
  path: (string | number)[];
  value: any[];
  onChangeAt: Props["onChangeAt"];
}) {
  const isPrimitiveArray = value.every(
    (v) => v === null || ["string", "number", "boolean"].includes(typeof v)
  );
  const addItem = () =>
    onChangeAt((root) => setAt(root, path, [...value, isPrimitiveArray ? "" : {}]));
  return (
    <div className="space-y-2">
      {isPrimitiveArray ? (
        <Lines
          value={(value as (string | number | boolean | null)[]).map((v) =>
            v === null ? "" : String(v)
          )}
          onChange={(arr) => onChangeAt((root) => setAt(root, path, arr))}
          placeholder="- one per line"
        />
      ) : (
        <div className="space-y-2">
          {value.map((v, i) => (
            <div key={i} className="rounded-xl border border-neutral-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-neutral-400">Item {i + 1}</div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onChangeAt((root) => {
                      const arr = [...(getAt(root, path) as any[])];
                      arr.splice(i, 1);
                      setAt(root, path, arr);
                    })
                  }
                >
                  Remove
                </Button>
              </div>
              <ObjectEditor
                kind={kind}
                path={[...path, i]}
                value={v}
                onChangeAt={onChangeAt}
              />
            </div>
          ))}
        </div>
      )}
      <Button size="sm" variant="secondary" onClick={addItem}>
        + Add
      </Button>
    </div>
  );
}

function PrimitiveEditor({
  kind,
  path,
  value,
  onChangeAt,
}: {
  kind: string;
  path: (string | number)[];
  value: string | number | boolean;
  onChangeAt: Props["onChangeAt"];
}) {
  const hint = getHint(kind, path, value);

  switch (hint?.widget) {
    case "boolean":
      return (
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) =>
              onChangeAt((root) => setAt(root, path, e.target.checked))
            }
          />
          <span className="text-neutral-300">True / False</span>
        </label>
      );

    case "number":
      return (
        <Input
          type="number"
          value={Number(value ?? 0)}
          onChange={(e) =>
            onChangeAt((root) => setAt(root, path, Number(e.target.value)))
          }
        />
      );

    case "select": {
      // Narrow to select variant so options are string[]
      type SelectHint = Extract<Hint, { widget: "select" }>;
      const opts = (hint as SelectHint).options;

      return (
        <select
          className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1 text-sm"
          value={String(value ?? "")}
          onChange={(e) => onChangeAt((root) => setAt(root, path, e.target.value))}
        >
          <option value="" />
          {opts.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    case "textarea":
      return (
        <Textarea
          rows={hint.rows ?? 6}
          value={String(value ?? "")}
          onChange={(e) => onChangeAt((root) => setAt(root, path, e.target.value))}
        />
      );

    case "code":
      return (
        <Textarea
          rows={hint.rows ?? 10}
          className="font-mono text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChangeAt((root) => setAt(root, path, e.target.value))}
        />
      );

    case "url":
      return (
        <Input
          type="url"
          value={String(value ?? "")}
          onChange={(e) => onChangeAt((root) => setAt(root, path, e.target.value))}
        />
      );

    case "lines":
      return (
        <Lines
          value={
            Array.isArray(value)
              ? (value as any[]).map((v) => (v == null ? "" : String(v)))
              : String(value ?? "").split("\n")
          }
          onChange={(arr) => onChangeAt((root) => setAt(root, path, arr))}
        />
      );

    case "text":
    default:
      return (
        <Input
          value={String(value ?? "")}
          onChange={(e) => onChangeAt((root) => setAt(root, path, e.target.value))}
        />
      );
  }
}

/* ---------------- UI helpers ---------------- */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-neutral-400 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Lines({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (arr: string[]) => void;
  placeholder?: string;
}) {
  return (
    <Textarea
      className="w-full min-h-[80px] text-sm"
      value={(value ?? []).join("\n")}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(
          e.target.value
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        )
      }
    />
  );
}

function EmptyValue({
  path,
  onChangeAt,
}: {
  path: (string | number)[];
  onChangeAt: Props["onChangeAt"];
}) {
  return (
    <div className="text-neutral-500 text-xs">
      (empty)
      <Button
        size="sm"
        className="ml-2"
        onClick={() => onChangeAt((root) => setAt(root, path, ""))}
      >
        Set value
      </Button>
    </div>
  );
}

/* ---------------- data utils ---------------- */

function setAt(root: any, path: (string | number)[], val: any) {
  if (path.length === 0) return;
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== "object") {
      const nextKey = path[i + 1];
      cur[k] = typeof nextKey === "number" ? [] : {};
    }
    cur = cur[k];
  }
  cur[path[path.length - 1]] = val;
}

function getAt(root: any, path: (string | number)[]) {
  return path.reduce((acc, k) => (acc ? acc[k] : undefined), root);
}

function labelize(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function preferOrderByKind(kind: string) {
  const pr = preferredOrder(kind);
  return (a: string, b: string) => {
    const ia = pr.indexOf(a);
    const ib = pr.indexOf(b);
    if (ia !== -1 || ib !== -1)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b);
  };
}
