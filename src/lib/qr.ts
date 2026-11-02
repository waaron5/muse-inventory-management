import { encode } from "uqr";

/** A QR code as one SVG path over a `size` × `size` grid. */
export type QrCode = { size: number; d: string };

/**
 * A QR code for `text` as one SVG path, a unit square per dark module, drawn
 * in whatever colour it's given. `size` includes the quiet border.
 */
export function qrCode(text: string): QrCode {
  const { size, data } = encode(text, { border: 1 });
  let d = "";
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return { size, d };
}
