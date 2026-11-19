'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Smartphone } from 'lucide-react';
import { Segmented } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { describeUrl } from '@/lib/push-engine-shared';

type Os = 'android' | 'ios';

/** How the push looks on a lock screen / notification shade, Android or iPhone. */
export function PushPreview({
  title,
  body,
  detail,
  url,
  className,
}: {
  title: string;
  body: string;
  detail?: string | null;
  url?: string | null;
  className?: string;
}) {
  const [os, setOs] = useState<Os>('android');
  const t = title.trim() || 'Notification title';
  const b = body.trim() || 'The message partners read on their phone.';
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">
          <Smartphone className="h-3.5 w-3.5" /> Preview
        </p>
        <Segmented
          label="Phone"
          value={os}
          onChange={setOs}
          options={[
            { value: 'android', label: 'Android' },
            { value: 'ios', label: 'iPhone' },
          ]}
        />
      </div>

      <div
        className={cn(
          'rounded-[22px] p-3',
          os === 'android' ? 'bg-gradient-to-b from-stone-800 to-stone-900' : 'bg-gradient-to-b from-sky-900 via-indigo-900 to-stone-900'
        )}
      >
        <p className="mb-2 text-center text-[11px] font-medium tabular text-white/70">
          {os === 'ios' ? '9:41' : '09:41 · Wed, 19 Nov'}
        </p>
        {os === 'android' ? (
          <div className="rounded-2xl bg-white/95 p-3 shadow-sm">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-stone-500">
              <Image src="/brand/lotmore-logo.png" alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-sm" />
              <span>Lot More Wins Partner</span>
              <span>· now</span>
            </div>
            <p className="line-clamp-1 text-[13px] font-semibold text-stone-900">{t}</p>
            <p className="line-clamp-2 text-[12.5px] leading-snug text-stone-700">{b}</p>
          </div>
        ) : (
          <div className="rounded-[18px] bg-white/80 p-3 shadow-sm backdrop-blur">
            <div className="flex gap-2.5">
              <Image src="/brand/lotmore-logo.png" alt="" width={34} height={34} className="h-[34px] w-[34px] shrink-0 rounded-[8px] bg-white" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="line-clamp-1 text-[13px] font-semibold text-stone-900">{t}</p>
                  <span className="shrink-0 text-[11px] text-stone-500">now</span>
                </div>
                <p className="line-clamp-4 text-[12.5px] leading-snug text-stone-800">{b}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1 text-xs text-stone-500">
        <p className="flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" /> On tap: <span className="font-medium text-stone-700">{describeUrl(url ?? null)}</span>
        </p>
        {detail?.trim() && <p>Has a full message on its own page in the app ({detail.trim().length.toLocaleString('en-IN')} characters).</p>}
      </div>
    </div>
  );
}
