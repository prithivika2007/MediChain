// Draws a QR code as an image, using the "qrcode" library.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRImage({ value, size = 130, alt }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => {});
    return () => { alive = false; };
  }, [value, size]);

  return src
    ? <img src={src} width={size} height={size} alt={alt || 'QR code'} />
    : <div className="qr-placeholder" style={{ width: size, height: size }} />;
}
