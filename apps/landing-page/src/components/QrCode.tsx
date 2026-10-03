import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  value: string;
  className?: string;
}

/** A QR code in the app's colours (deep red on ivory) inside gold corner brackets. */
export function QrCode({ value, className = '' }: QrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: 720,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#5A0303', light: '#FBF6EC' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch((error) => console.error('QR code could not be generated:', error));
    return () => {
      cancelled = true;
    };
  }, [value]);

  const corner = 'absolute h-9 w-9 border-gilt sm:h-11 sm:w-11';

  return (
    <div className={`relative p-4 sm:p-5 ${className}`}>
      <span className={`${corner} left-0 top-0 border-l-2 border-t-2`} aria-hidden />
      <span className={`${corner} right-0 top-0 border-r-2 border-t-2`} aria-hidden />
      <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} aria-hidden />
      <span className={`${corner} bottom-0 right-0 border-b-2 border-r-2`} aria-hidden />
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[#FBF6EC] p-3 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.85)]">
        {src && <img src={src} alt={`QR code that opens ${value}`} className="h-full w-full" />}
      </div>
    </div>
  );
}
