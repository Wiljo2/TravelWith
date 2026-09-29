import { ImageResponse } from "next/og";

// Full-bleed square so iOS and Android can apply their own corner mask.
export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#04342C",
          color: "#6EE7B7",
          fontSize: size * 0.4,
          fontWeight: 700,
          letterSpacing: -size * 0.02,
        }}
      >
        TW
      </div>
    ),
    { width: size, height: size },
  );
}
