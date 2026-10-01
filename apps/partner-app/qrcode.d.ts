/** The part of `qrcode` (the QR encoder react-native-qrcode-svg is built on) that lib/qr-png.ts uses. */
declare module 'qrcode' {
  interface QRCodeModules {
    /** Modules per side. */
    size: number;
    /** Row-major module values; non-zero = dark. */
    data: Uint8Array;
  }
  const QRCode: {
    create(text: string, options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): { modules: QRCodeModules };
  };
  export default QRCode;
}
