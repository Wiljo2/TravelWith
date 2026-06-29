export interface CalendarEvent {
  id: string;
  start: number;
  end: number;
  title: string;
  cat: string;
  note: string;
}

export interface Day {
  id: string;
  label: string;
  sub: string;
  flexible: boolean;
  portWindow?: [number, number];
  events: CalendarEvent[];
}

export interface Category {
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export interface DragPreview {
  dayId: string;
  newStart: number;
  newEnd: number;
  ev: CalendarEvent;
}

export interface Extra {
  id: string;
  label: string;
  amount: number;
}

export interface ToastAction {
  title: string;
  newStart: number;
  newEnd: number;
  undo: () => void;
}
