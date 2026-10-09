export interface ItemIcon {
  label: string;
  emoji: string;
  keywords: string[];
}

// Emoji suggested from an item's title. Order matters: the first entry with a
// matching keyword wins, so specific entries go before generic ones. Keywords are
// accent-free, lowercase whole words or phrases.
export const ITEM_ICONS: Record<string, ItemIcon> = {
  flight:     { label: "Vuelo",        emoji: "✈️", keywords: ["vuelo", "vuelos", "aeropuerto", "flight", "flights", "airport", "avion", "aerolinea", "airline"] },
  breakfast:  { label: "Desayuno",     emoji: "🥐", keywords: ["desayuno", "desayunos", "breakfast", "brunch"] },
  meal:       { label: "Comida",       emoji: "🍽️", keywords: ["almuerzo", "almuerzos", "lunch", "cena", "cenas", "dinner", "comida", "restaurante", "restaurantes", "restaurant", "restaurants", "buffet"] },
  coffee:     { label: "Café",         emoji: "☕", keywords: ["cafe", "cafes", "cafeteria", "coffee", "starbucks"] },
  beer:       { label: "Cerveza",      emoji: "🍺", keywords: ["cerveza", "cervezas", "cerveceria", "beer", "beers", "brewery", "pub"] },
  drinks:     { label: "Bar y fiesta", emoji: "🍸", keywords: ["bar", "bares", "coctel", "cocteles", "cocktail", "cocktails", "drink", "drinks", "trago", "tragos", "fiesta", "fiestas", "discoteca", "club", "party", "happy hour"] },
  amusement:  { label: "Parque de diversiones", emoji: "🎢", keywords: ["parque de diversiones", "parque tematico", "disney", "universal", "theme park", "amusement park", "montana rusa", "roller coaster"] },
  beach:      { label: "Playa",        emoji: "🏖️", keywords: ["playa", "playas", "beach", "beaches"] },
  pool:       { label: "Piscina",      emoji: "🏊", keywords: ["piscina", "piscinas", "alberca", "pool", "pools", "nadar", "swim"] },
  museum:     { label: "Museo",        emoji: "🏛️", keywords: ["museo", "museos", "museum", "museums", "galeria", "galerias", "gallery", "galleries"] },
  worship:    { label: "Iglesia",      emoji: "⛪", keywords: ["iglesia", "iglesias", "catedral", "catedrales", "church", "cathedral", "basilica", "templo"] },
  cruise:     { label: "Barco",        emoji: "🛳️", keywords: ["barco", "barcos", "crucero", "cruceros", "ferry", "lancha", "cruise", "boat", "ship", "catamaran", "velero"] },
  port:       { label: "Embarque",     emoji: "⚓", keywords: ["embarque", "desembarque", "puerto", "port", "embark", "disembark", "boarding"] },
  tour:       { label: "Tour",         emoji: "🗺️", keywords: ["tour", "tours", "city tour", "recorrido", "recorridos", "excursion", "excursiones", "guided", "sightseeing"] },
  park:       { label: "Parque",       emoji: "🌳", keywords: ["parque", "parques", "park", "parks", "jardin", "jardines", "garden", "gardens"] },
  supermarket:{ label: "Supermercado", emoji: "🛒", keywords: ["supermercado", "supermercados", "super", "supermarket", "grocery", "groceries", "abarrotes"] },
  shopping:   { label: "Compras",      emoji: "🛍️", keywords: ["compras", "comprar", "shopping", "mall", "malls", "outlet", "outlets", "mercado", "mercados", "market", "souvenirs", "souvenir", "tienda", "tiendas"] },
  train:      { label: "Tren",         emoji: "🚆", keywords: ["tren", "trenes", "train", "trains", "metro", "subway", "estacion de tren"] },
  bus:        { label: "Bus",          emoji: "🚌", keywords: ["bus", "buses", "autobus", "autobuses", "colectivo", "shuttle"] },
  car:        { label: "Carro",        emoji: "🚗", keywords: ["carro", "carros", "auto", "autos", "uber", "taxi", "taxis", "lyft", "renta de carro", "alquiler de auto", "car rental", "rental car", "coche", "manejar", "drive"] },
  lodging:    { label: "Hotel",        emoji: "🏨", keywords: ["hotel", "hoteles", "hospedaje", "alojamiento", "check in", "check out", "checkin", "checkout", "airbnb", "hostal", "hostel", "resort", "lodging"] },
  hike:       { label: "Caminata",     emoji: "🥾", keywords: ["caminata", "caminatas", "senderismo", "hike", "hiking", "trek", "trekking", "sendero"] },
  mountain:   { label: "Montaña",      emoji: "🏔️", keywords: ["montana", "montanas", "volcan", "volcanes", "mountain", "mountains", "volcano", "cerro"] },
  spa:        { label: "Spa",          emoji: "💆", keywords: ["spa", "masaje", "masajes", "massage", "sauna"] },
  theater:    { label: "Teatro",       emoji: "🎭", keywords: ["teatro", "teatros", "theater", "theatre", "broadway", "opera", "musical"] },
  concert:    { label: "Concierto",    emoji: "🎵", keywords: ["concierto", "conciertos", "concert", "show", "shows", "musica", "music", "festival"] },
  cinema:     { label: "Cine",         emoji: "🎬", keywords: ["cine", "pelicula", "peliculas", "movie", "movies", "film", "cinema"] },
  sports:     { label: "Deporte",      emoji: "⚽", keywords: ["deporte", "deportes", "futbol", "partido", "estadio", "football", "soccer", "game", "stadium", "basketball", "baloncesto", "beisbol", "baseball"] },
  birthday:   { label: "Cumpleaños",   emoji: "🎂", keywords: ["cumpleanos", "cumple", "birthday", "aniversario", "anniversary"] },
  photo:      { label: "Fotos",        emoji: "📸", keywords: ["foto", "fotos", "photo", "photos", "photoshoot", "sesion de fotos"] },
  diving:     { label: "Buceo",        emoji: "🤿", keywords: ["buceo", "bucear", "snorkel", "snorkeling", "diving", "scuba"] },
  water:      { label: "Kayak y surf", emoji: "🏄", keywords: ["kayak", "kayaks", "surf", "surfing", "paddle", "paddleboard", "jet ski"] },
  zoo:        { label: "Zoológico",    emoji: "🐠", keywords: ["zoologico", "zoologicos", "zoo", "acuario", "acuarios", "aquarium", "safari"] },
  snow:       { label: "Nieve",        emoji: "🎿", keywords: ["nieve", "ski", "esqui", "esquiar", "snow", "snowboard"] },
  luggage:    { label: "Equipaje",     emoji: "🧳", keywords: ["maleta", "maletas", "empacar", "equipaje", "luggage", "baggage", "pack", "packing", "suitcase"] },
  documents:  { label: "Documentos",   emoji: "🛂", keywords: ["pasaporte", "pasaportes", "passport", "visa", "visas", "migracion", "immigration", "aduana", "customs"] },
  money:      { label: "Dinero",       emoji: "💵", keywords: ["dinero", "cambio de moneda", "cajero", "atm", "efectivo", "cash", "money", "currency exchange"] },
  insurance:  { label: "Seguro",       emoji: "🛡️", keywords: ["seguro", "seguros", "insurance"] },
  health:     { label: "Salud",        emoji: "🏥", keywords: ["hospital", "farmacia", "pharmacy", "doctor", "medico", "clinica", "clinic"] },
  booking:    { label: "Reserva",      emoji: "📅", keywords: ["reserva", "reservas", "reservar", "booking", "bookings", "reservation", "reservations", "book"] },
  rest:       { label: "Descanso",     emoji: "😴", keywords: ["descanso", "descansar", "siesta", "libre", "relax", "rest", "free time", "tiempo libre"] },
  night:      { label: "Noche",        emoji: "🌙", keywords: ["noche", "noches", "night", "nights", "nocturno"] },
};

const GENERIC_EXTRAS = ["📍", "⭐", "❤️", "🎉", "📝", "✨"];

export const ICON_CHOICES: string[] = [...new Set([...Object.values(ITEM_ICONS).map((i) => i.emoji), ...GENERIC_EXTRAS])];

export const DEFAULT_EVENT_ICON = "📍";
