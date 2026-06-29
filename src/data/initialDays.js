import { uid } from "../utils/uid";

const mk = (start, end, title, cat, note = "") => ({
  id: uid(), start, end, title, cat, note,
});

export const initialDays = [
  {
    id: "d0",
    label: "Sáb · Nov 28",
    sub: "Miami pre-crucero (flexible)",
    flexible: true,
    events: [
      mk(11, 12, "Llegada / check-in hotel", "logist", "Uber desde MIA al hotel"),
      mk(12.5, 14, "Almuerzo Little Havana", "comida", "Cafecito + frita en Calle Ocho"),
      mk(14.5, 17, "Wynwood Walls + galerías", "miami", "Murales y arte callejero"),
      mk(18, 19.5, "South Beach / Ocean Drive", "miami", "Atardecer y caminata Art Deco"),
      mk(20.5, 23.5, "Cena + bares South Beach", "noche", "Mojitos y nightlife"),
    ],
  },
  {
    id: "d1",
    label: "Dom · Nov 29",
    sub: "Miami pre-crucero (flexible)",
    flexible: true,
    events: [
      mk(9.5, 11, "Desayuno + Vizcaya", "miami", "Jardines estilo renacentista"),
      mk(11.5, 13.5, "Key Biscayne / faro", "miami", "Playas tranquilas, Bill Baggs"),
      mk(14, 16, "Bayside + compras", "miami", "Frente al puerto"),
      mk(19, 21, "Cena stone crab", "comida", "Marisco clásico del sur de FL"),
      mk(21.5, 24, "Brickell rooftop bars", "noche", "Coctelería y vista de la ciudad"),
    ],
  },
  {
    id: "d2",
    label: "Lun · Nov 30",
    sub: "Embarque · Día 1",
    flexible: false,
    events: [
      mk(11, 13, "Check-in puerto / embarque", "logist", "Llegar temprano, evita filas"),
      mk(13, 15.5, "Almuerzo + explorar el barco", "barco", "Windjammer, recorrido cubiertas"),
      mk(16.5, 16.5, "Zarpe de Miami", "logist", "Departs 4:30 pm"),
      mk(17, 18, "Drill de seguridad + sail away", "barco", ""),
      mk(20, 22, "Cena + show de bienvenida", "barco", "AquaTheater / comedor principal"),
    ],
  },
  {
    id: "d3",
    label: "Mar · Dic 1",
    sub: "Día en el mar · Día 2",
    flexible: false,
    events: [
      mk(9, 10.5, "FlowRider / Ultimate Abyss", "barco", "Llega temprano a las atracciones"),
      mk(11, 12.5, "Spa o piscina", "barco", ""),
      mk(13, 14, "Almuerzo", "comida", ""),
      mk(15, 16.5, "Mini golf Wonder Dunes", "barco", ""),
      mk(19.5, 21, "Cena especialidad", "comida", "Wonderland / 150 Central Park"),
      mk(21.5, 23.5, "Show nocturno + bar", "noche", "Vue Bar"),
    ],
  },
  {
    id: "d4",
    label: "Mié · Dic 2",
    sub: "Nassau · Día 3 · 7:30a–5:30p",
    flexible: false,
    portWindow: [7.5, 17.5],
    events: [
      mk(7.5, 8, "Atraque en Nassau", "logist", "Docked 7:30 am"),
      mk(8.5, 12.5, "Royal Beach Club / Pearl Island", "puerto", "Excursión playa todo el día"),
      mk(13, 14, "Almuerzo bahameño", "comida", "Conch, rock lobster"),
      mk(14.5, 16.5, "Bay St + Straw Market", "puerto", "Compras duty-free"),
      mk(17, 17.5, "Regreso al barco", "logist", "All aboard antes de 5:30 pm"),
      mk(20, 22, "Cena + casino/teatro", "noche", ""),
    ],
  },
  {
    id: "d5",
    label: "Jue · Dic 3",
    sub: "Perfect Day CocoCay · Día 4 · 7:00a–5:00p",
    flexible: false,
    portWindow: [7, 17],
    events: [
      mk(7, 7.5, "Atraque en CocoCay", "logist", "Docked 7:00 am"),
      mk(8, 10, "Thrill Waterpark", "puerto", "Llega 10 am máx para evitar filas"),
      mk(10.5, 12.5, "Oasis Lagoon / playa", "puerto", "Piscina de agua dulce más grande"),
      mk(13, 14, "Almuerzo Chill Grill", "comida", ""),
      mk(14.5, 16, "Hideaway Beach (adultos)", "puerto", "Swim-up bar, DJ"),
      mk(16.5, 17, "Regreso al barco", "logist", "All aboard antes de 5:00 pm"),
      mk(20, 22.5, "Última cena + show", "barco", ""),
    ],
  },
  {
    id: "d6",
    label: "Vie · Dic 4",
    sub: "Desembarque · Día 5",
    flexible: false,
    events: [
      mk(6, 6.5, "Llegada a Miami", "logist", "Arrives 6:00 am"),
      mk(7.5, 9, "Desayuno + desembarque", "logist", "Self-assist sale más rápido"),
      mk(9.5, 11, "Uber a aeropuerto / hotel", "logist", ""),
    ],
  },
];
