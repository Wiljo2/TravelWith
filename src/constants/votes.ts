import type { TaskDecides } from "@/types";

export interface VoteKind {
  title: string;     // the vote task's title
  start: string;     // action that opens the vote
  propose: string;   // action that adds an option
  close: string;     // title of the owner's closing dialog
  empty: string;     // hint while the vote has no options
}

export const VOTE_KINDS: Record<TaskDecides, VoteKind> = {
  dates: {
    title: "¿Cuándo viajamos?",
    start: "Votar fechas",
    propose: "Agregar fechas",
    close: "Elegir las fechas",
    empty: "Propongan 2 o 3 rangos de fechas y voten con ✋ los que les sirvan.",
  },
  destination: {
    title: "¿A dónde vamos?",
    start: "Votar destino",
    propose: "Agregar destino",
    close: "Elegir el destino",
    empty: "Propongan 2 o 3 destinos y voten con ✋ los que les gusten.",
  },
};

export const VOTE_KIND_KEYS = Object.keys(VOTE_KINDS) as TaskDecides[];

// The category every vote task gets (forced by the server too).
export const VOTE_TASK_CAT = "decidir";
