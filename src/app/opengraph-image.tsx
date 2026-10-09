import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION } from "@/lib/site";

export const alt = "TravelWith: planea viajes en grupo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const EVENTS = [
  { time: "08:00", label: "Vuelo a Cartagena", color: "#378ADD" },
  { time: "11:30", label: "Playa Blanca", color: "#EF9F27" },
  { time: "20:00", label: "Cena en el centro", color: "#D85A30" },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#F7F6F2",
          color: "#2C2C2A",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 600 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: "#04342C" }}>
            <span style={{ background: "#6EE7B7", borderRadius: 999, padding: "6px 20px" }}>TravelWith</span>
          </div>
          <div style={{ marginTop: 32, fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
            Planea viajes en grupo, todos en la misma página
          </div>
          <div style={{ marginTop: 24, fontSize: 28, color: "#888780", lineHeight: 1.35 }}>{SITE_DESCRIPTION}</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 380,
            padding: 28,
            borderRadius: 28,
            background: "#ffffff",
            border: "2px solid #ECEAE3",
          }}
        >
          <div style={{ fontSize: 20, color: "#888780" }}>Sábado 14</div>
          <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 16 }}>Cartagena</div>
          {EVENTS.map((e) => (
            <div key={e.time} style={{ display: "flex", alignItems: "center", marginTop: 12 }}>
              <div style={{ width: 70, fontSize: 18, color: "#888780" }}>{e.time}</div>
              <div
                style={{
                  flex: 1,
                  fontSize: 22,
                  padding: "14px 16px",
                  borderRadius: 12,
                  borderLeft: `6px solid ${e.color}`,
                  background: `${e.color}26`,
                }}
              >
                {e.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
