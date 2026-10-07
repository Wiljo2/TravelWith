// What kind of idea a shared reel/TikTok is. Independent from the calendar's
// CATEGORIES: ideas are inspiration about places, not itinerary blocks.
export interface IdeaType {
  label: string;
  icon: string;
  // Accent-free, lowercase cues for the rules classifier (whole words/phrases).
  keywords: string[];
}

export const IDEA_TYPES: Record<string, IdeaType> = {
  tip: {
    label: "Tip",
    icon: "💡",
    keywords: ["tip", "tips", "consejo", "consejos", "truco", "trucos", "hack", "hacks", "no saben", "que saber",
               "debes saber", "tienes que saber", "ahorra", "ahorrar", "ahorro", "precio", "precios", "gratis", "free",
               "evita", "evitar", "error", "errores", "guia", "guide", "how to", "recomendaciones", "secreto"],
  },
  comida: {
    label: "Comida",
    icon: "🍽️",
    keywords: ["restaurante", "restaurantes", "restaurant", "restaurants", "comida", "food", "comer", "eat", "cena",
               "dinner", "almuerzo", "lunch", "desayuno", "breakfast", "brunch", "cafe", "cafecito", "coffee", "postre",
               "postres", "dessert", "desserts", "helado", "helados", "ice cream", "cerveza", "cervezas", "beer", "pizza", "tacos", "sushi", "burger", "hamburguesa", "steak", "mariscos", "seafood",
               "foodie", "butterbeer", "bakery", "panaderia", "bebida", "bebidas", "snack", "snacks", "delicioso"],
  },
  actividad: {
    label: "Actividad",
    icon: "🎢",
    keywords: ["parque", "parques", "park", "parks", "rides", "atraccion", "atracciones", "attraction", "montana rusa",
               "rollercoaster", "playa", "beach", "snorkel", "tour", "excursion", "kayak", "buceo", "museo", "museum",
               "waterpark", "acuatico", "show", "espectaculo", "que hacer", "things to do", "planes", "plan", "visitar"],
  },
  compras: {
    label: "Compras",
    icon: "🛍️",
    keywords: ["compras", "comprar", "shopping", "outlet", "outlets", "mall", "tienda", "tiendas", "store", "souvenir",
               "souvenirs", "duty free", "descuento", "descuentos", "ofertas", "nike", "marcas"],
  },
  noche: {
    label: "Noche",
    icon: "🌙",
    keywords: ["bar", "bares", "rooftop", "club", "discoteca", "fiesta", "party", "nightlife", "coctel", "cocteles",
               "cocktail", "cocktails", "drinks", "tragos", "casino", "karaoke", "noche"],
  },
};

// Tie-breaking order for the rules classifier: most specific signals first.
export const IDEA_TYPE_PRIORITY = ["tip", "comida", "noche", "compras", "actividad"];
