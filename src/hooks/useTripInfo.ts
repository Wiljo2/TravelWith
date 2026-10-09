import { useCallback, useState } from "react";
import type { MockPerson, TripInfo } from "@/types";
import { applyToList, rowToTraveler, type Row } from "@/utils/tripRows";
import type { SendOp } from "@/hooks/useTripOps";

// Trip header (name, destination, dates) and travelers without an account.
export function useTripInfo(send: SendOp) {
  const [trip, setTrip] = useState<TripInfo | null>(null);
  const [mockPeople, setMockPeople] = useState<MockPerson[]>([]);

  function addMockPerson(name: string) {
    const person = { id: crypto.randomUUID(), name };
    setMockPeople((prev) => [...prev, person]);
    send("traveler.add", person);
  }

  function removeMockPerson(id: string) {
    setMockPeople((prev) => prev.filter((p) => p.id !== id));
    send("traveler.remove", { id });
  }

  const loadTripInfo = useCallback((incoming: TripInfo | undefined, people: MockPerson[] | undefined) => {
    if (incoming?.name) setTrip(incoming);
    if (Array.isArray(people)) setMockPeople(people);
  }, []);

  // Header as stored on rooms (op responses and, later, Broadcast).
  const applyHeader = useCallback((h: Record<string, unknown>) => {
    setTrip((prev) => {
      const startDate = h.start_date ?? prev?.startDate;
      const endDate = h.end_date ?? prev?.endDate;
      if (!startDate || !endDate) return prev;
      return {
        name: String(h.name ?? prev?.name ?? ""),
        destination: h.destination == null ? undefined : String(h.destination),
        startDate: String(startDate),
        endDate: String(endDate),
      };
    });
  }, []);

  const applyRow = useCallback((id: string, row: Row | null) => {
    setMockPeople((prev) => applyToList(prev, id, row, rowToTraveler));
  }, []);

  return { trip, mockPeople, addMockPerson, removeMockPerson, loadTripInfo, applyHeader, applyRow };
}
