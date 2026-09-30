import { MaintenanceError } from "@/server/http";

// MAINTENANCE_MODE=on freezes trip writes during the cut-over window
// (docs/plans/cutover-runbook.md): write routes answer 503 and clients retry.
// Reads stay available. Read per request so tests and deploys see the value.
export function isMaintenance(): boolean {
  return process.env.MAINTENANCE_MODE === "on";
}

export function assertWritable(): void {
  if (isMaintenance()) throw new MaintenanceError();
}
