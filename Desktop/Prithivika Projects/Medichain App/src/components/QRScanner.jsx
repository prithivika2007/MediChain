// Camera QR scanner using the "html5-qrcode" library.
// When a QR code is read, we call onScan(text) and the parent verifies it.
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan; // always call the latest version of the callback

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    let cancelled = false;
    let started = false;
    let handled = false;

    const stop = () => {
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };

    scanner
      .start(
        { facingMode: 'environment' },            // use the back camera on phones
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          if (handled) return;                    // only react to the first successful read
          handled = true;
          onScanRef.current(decodedText);
        },
        () => {}                                  // called on every frame with no QR: ignore
      )
      .then(() => {
        started = true;
        if (cancelled) stop();
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not start the camera. Allow camera access (it works on localhost or https), or type the Pack ID instead.');
        }
      });

    // cleanup: turn the camera off when this component disappears
    return () => {
      cancelled = true;
      if (started) stop();
    };
  }, []);

  return (
    <div className="scanner-box">
      <div id="qr-reader" className="qr-reader" />
      {error && <p className="error-text">{error}</p>}
      <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
        Cancel scanning
      </button>
    </div>
  );
}
