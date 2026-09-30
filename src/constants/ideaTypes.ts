// What kind of idea a shared reel/TikTok is. Independent from the calendar's
// CATEGORIES: ideas are inspiration about places, not itinerary blocks.
export interface IdeaType {
  label: string;
  icon: string;
  // Accent-free, lowercase cues for the rules classifier (whole words/phrases).
  keywords: string[];
  // Short bilingual descriptions for the in-browser AI model.
  prototypes: string[];
}

export const IDEA_TYPES: Record<string, IdeaType> = {
  tip: {
    label: "Tip",
    icon: "💡",
    keywords: ["tip", "tips", "consejo", "consejos", "truco", "trucos", "hack", "hacks", "no saben", "que saber",
               "debes saber", "tienes que saber", "ahorra", "ahorrar", "ahorro", "precio", "precios", "gratis", "free",
               "evita", "evitar", "error", "errores", "guia", "guide", "how to", "recomendaciones", "secreto"],
    prototypes: ["consejos, trucos y cosas que debes saber antes de ir", "travel tips, hacks and how to save money",
                 "precios, recomendaciones y errores que evitar"],
  },
  comida: {
    label: "Comida",
    icon: "🍽️",
    keywords: ["restaurante", "restaurantes", "restaurant", "restaurants", "comida", "food", "comer", "eat", "cena",
               "dinner", "almuerzo", "lunch", "desayuno", "breakfast", "brunch", "cafe", "cafecito", "coffee", "postre",
               "postres", "dessert", "desserts", "helado", "helados", "ice cream", "cerveza", "cervezas", "beer", "pizza", "tacos", "sushi", "burger", "hamburguesa", "steak", "mariscos", "seafood",
               "foodie", "butterbeer", "bakery", "panaderia", "bebida", "bebidas", "snack", "snacks", "delicioso"],
    prototypes: ["restaurantes, comida y dónde comer", "best food, restaurants and snacks to try",
                 "desayuno, almuerzo, cena, postres y bebidas"],
  },
  actividad: {
    label: "Actividad",
    icon: "🎢",
    keywords: ["parque", "parques", "park", "parks", "rides", "atraccion", "atracciones", "attraction", "montana rusa",
               "rollercoaster", "playa", "beach", "snorkel", "tour", "excursion", "kayak", "buceo", "museo", "museum",
               "waterpark", "acuatico", "show", "espectaculo", "que hacer", "things to do", "planes", "plan", "visitar"],
    prototypes: ["actividades, atracciones y planes para hacer", "things to do, rides, tours and attractions",
                 "playa, excursiones y parques"],
  },
  compras: {
    label: "Compras",
    icon: "🛍️",
    keywords: ["compras", "comprar", "shopping", "outlet", "outlets", "mall", "tienda", "tiendas", "store", "souvenir",
               "souvenirs", "duty free", "descuento", "descuentos", "ofertas", "nike", "marcas"],
    prototypes: ["compras, outlets y tiendas", "shopping, outlets, stores and souvenirs"],
  },
  noche: {
    label: "Noche",
    icon: "🌙",
    keywords: ["bar", "bares", "rooftop", "club", "discoteca", "fiesta", "party", "nightlife", "coctel", "cocteles",
               "cocktail", "cocktails", "drinks", "tragos", "casino", "karaoke", "noche"],
    prototypes: ["vida nocturna, bares y fiestas", "nightlife, rooftop bars, cocktails and clubs"],
  },
};

// Tie-breaking order for the rules classifier: most specific signals first.
export const IDEA_TYPE_PRIORITY = ["tip", "comida", "noche", "compras", "actividad"];
