import { ImageResponse } from "next/og";

/**
 * App icon: three lines of script on warm ink, the middle one lit in amber
 * (the line being read). `padding` leaves a safe zone for maskable icons.
 */
export function renderIcon(size: number, padding = 0.16) {
  const pad = Math.round(size * padding);
  const barH = Math.round(size * 0.09);
  const gap = Math.round(size * 0.07);
  const radius = Math.round(size * 0.22);
  const inner = size - pad * 2;

  const bar = (widthPct: number, color: string) => (
    <div
      style={{
        width: Math.round(inner * widthPct),
        height: barH,
        borderRadius: barH,
        background: color,
      }}
    />
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap,
          background: "#0f0e0c",
          borderRadius: padding >= 0.15 ? 0 : radius,
        }}
      >
        {bar(0.8, "#4a463d")}
        {bar(1, "#ffc247")}
        {bar(0.6, "#4a463d")}
      </div>
    ),
    { width: size, height: size },
  );
}
