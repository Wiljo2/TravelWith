import { useState } from "react";

const CRUISE_PRICE_PER_PERSON = 429;
const GUESTS = 2;

const DEFAULT_EXTRAS = [
  { id: "x1", label: "Hotel Miami (2 noches)", amount: 360 },
  { id: "x2", label: "Vuelos ida/vuelta (2 pax)", amount: 700 },
  { id: "x3", label: "Excursiones / cabanas", amount: 250 },
  { id: "x4", label: "Comidas + Uber + extras", amount: 500 },
];

export function useBudget() {
  const [extras, setExtras] = useState(DEFAULT_EXTRAS);

  const cruiseTotal = CRUISE_PRICE_PER_PERSON * GUESTS;
  const extrasTotal = extras.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const grandTotal = cruiseTotal + extrasTotal;

  function updateExtra(id, patch) {
    setExtras((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  return {
    extras,
    cruiseTotal,
    extrasTotal,
    grandTotal,
    pricePerPerson: CRUISE_PRICE_PER_PERSON,
    updateExtra,
  };
}
