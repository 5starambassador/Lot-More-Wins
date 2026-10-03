'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { MAX_OUTLET_IMAGES } from '@lotmorewins/validation';
import { adminApi, errorMessage, fileToBase64 } from '@/lib/admin-client';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'] as const;
type Accepted = (typeof ACCEPTED)[number];

async function upload(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type as Accepted)) throw new Error('Use a JPEG, PNG or WebP image');
  if (file.size > 3 * 1024 * 1024) throw new Error('Image must be smaller than 3 MB');
  const res = await adminApi.uploadMedia({ mimeType: file.type as Accepted, base64: await fileToBase64(file) });
  return res.data.url;
}

function Thumb({ url, onRemove, label }: { url: string; onRemove: () => void; label: string }) {
  return (
    <div className="group relative h-24 w-24 overflow-hidden rounded-md border border-stone-150 bg-stone-50 animate-fade-in">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="absolute right-1 top-1 rounded-full bg-maroon-950/80 p-1 text-white opacity-0 transition-opacity hover:bg-red-700 focus:opacity-100 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AddTile({ busy, onPick, label }: { busy: boolean; onPick: (files: FileList) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-stone-300 bg-stone-25 text-[11px] font-medium text-stone-500 transition-colors hover:border-gold-500 hover:bg-gold-50 hover:text-gold-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
        {busy ? 'Uploading…' : label}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

/** A single image: the outlet logo, or any other one-image setting (`label` names it). */
export function LogoUpload({
  value,
  onChange,
  label = 'logo',
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {value ? (
          <Thumb url={value} label={label} onRemove={() => onChange(null)} />
        ) : (
          <AddTile
            busy={busy}
            label={`Add ${label}`}
            onPick={async (files) => {
              setBusy(true);
              setError(null);
              try {
                onChange(await upload(files[0]!));
              } catch (err) {
                setError(errorMessage(err, err instanceof Error ? err.message : 'Upload failed'));
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function GalleryUpload({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {value.map((url, i) => (
          <Thumb key={url} url={url} label={`image ${i + 1}`} onRemove={() => onChange(value.filter((u) => u !== url))} />
        ))}
        {value.length < MAX_OUTLET_IMAGES && (
          <AddTile
            busy={busy}
            label="Add photo"
            onPick={async (files) => {
              setBusy(true);
              setError(null);
              try {
                onChange([...value, await upload(files[0]!)]);
              } catch (err) {
                setError(errorMessage(err, err instanceof Error ? err.message : 'Upload failed'));
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </div>
      {value.length >= MAX_OUTLET_IMAGES && (
        <p className="text-xs text-stone-500">
          This outlet has the maximum of {MAX_OUTLET_IMAGES} photos. Remove one to add another.
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
