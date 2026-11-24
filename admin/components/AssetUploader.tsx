"use client";

import { useRef, useState } from "react";
import { uploadAsset, type UploadKind } from "../lib/api";
import { useAdmin } from "../lib/context";

interface Props {
  kind: UploadKind;
  accept: string;
  label: string;
  value: string | null;
  onChange: (key: string | null) => void;
  preview?: boolean;
}

export function AssetUploader({ kind, accept, label, value, onChange, preview }: Props) {
  const { notify, assetUrl } = useAdmin();
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setPct(0);
    try {
      onChange(await uploadAsset(kind, file, setPct));
      notify(`${file.name} uploaded`);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setPct(null);
      if (input.current) input.current.value = "";
    }
  }

  const url = assetUrl(value);
  return (
    <div>
      <span className="label">{label}</span>
      <div
        className="flex items-center gap-4 rounded-sm border border-dashed border-line bg-ink p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void pick(e.dataTransfer.files[0]);
        }}
      >
        {preview && url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-16 w-16 rounded-sm object-cover" />
        )}
        <div className="min-w-0 flex-1 text-sm">
          {pct !== null ? (
            <div>
              <div className="h-1.5 overflow-hidden rounded bg-line"><div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} /></div>
              <div className="mt-1 text-xs text-mute">Uploading {pct}%</div>
            </div>
          ) : value ? (
            <span className="block truncate font-mono text-xs text-bone" title={value}>{value.split("/").pop()}</span>
          ) : (
            <span className="text-mute">Drop a file here or browse</span>
          )}
        </div>
        <input ref={input} type="file" accept={accept} hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" className="btn" onClick={() => input.current?.click()} disabled={pct !== null}>{value ? "Replace" : "Browse"}</button>
        {value && <button type="button" className="btn btn-danger" onClick={() => onChange(null)} disabled={pct !== null}>Remove</button>}
      </div>
    </div>
  );
}
