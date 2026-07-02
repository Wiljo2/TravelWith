import { HOUR_START, HOUR_END, PX_PER_HOUR } from "../../constants/time";
import { fmtHourShort } from "../../utils/time";

export default function HourGutter() {
  const hours: number[] = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

  return (
    <div style={{ width: 56, flexShrink: 0, position: "relative" }}>
      {hours.map((h) => (
        <div
          key={h}
          style={{
            height: PX_PER_HOUR,
            position: "relative",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: -8,
              right: 8,
              fontSize: 11,
              color: "var(--text-muted)",
              fontVariantNumeric: "tabular-nums",
              background: "var(--surface-0)",
              padding: "0 2px",
            }}
          >
            {fmtHourShort(h)}
          </span>
        </div>
      ))}
    </div>
  );
}
