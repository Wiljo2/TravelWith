// Database types for the public schema, written by hand to match migrations
// 001-015 (docs/plans/relational-broadcast.md, step 1.4). Once a Supabase
// project with these migrations is available, replace this file with:
//
//   npx supabase gen types typescript --project-id <id> --schema public > src/types/database.ts
//
// then re-add the row aliases (e.g. `type TripEventRow = Tables<"trip_events">`),
// TripTable and the literal unions for currency, split_mode, priority and op. Functions in schema private are not
// exposed through the API and are not listed here.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relationship<Name extends string, Columns extends string[], Target extends string, TargetColumns extends string[]> = {
  foreignKeyName: Name;
  columns: Columns;
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: TargetColumns;
};

type RoomFk<T extends string> = Relationship<`${T}_room_code_fkey`, ["room_code"], "rooms", ["code"]>;

// Columns with a database default (or nullable) are optional on insert; every
// column is optional on update.
type InsertOf<Row, Defaulted extends keyof Row> = Omit<Row, Defaulted> & Partial<Pick<Row, Defaulted>>;
type TableOf<Row, Defaulted extends keyof Row, Relationships extends unknown[]> = {
  Row: Row;
  Insert: InsertOf<Row, Defaulted>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

type Flat<T> = { [K in keyof T]: T[K] };

type RowMeta = {
  room_code: string;
  id: string;
  version: number;
  updated_at: string;
  updated_by: string | null;
};
type MetaDefaults = "version" | "updated_at" | "updated_by";

type RoomRow = {
  code: string;
  payload: Json;
  updated_at: string;
  name: string | null;
  members: Json;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  exchange_rate: number | null;
};

type UserRoomRow = {
  user_id: string;
  room_code: string;
  role: string;
  joined_at: string;
  last_active_at: string;
};

type AgentUsageRow = {
  id: number;
  user_id: string;
  room_code: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
};

type TripDayRow = Flat<RowMeta & {
  position: number;
  label: string;
  sub: string | null;
  flexible: boolean | null;
}>;

type TripEventRow = Flat<RowMeta & {
  day_id: string;
  position: number;
  start_hour: number;
  end_hour: number;
  title: string;
  cat: string;
  note: string | null;
}>;

type TripDaySpanRow = Flat<RowMeta & {
  day_id: string;
  position: number;
  label: string | null;
  start_event_id: string | null;
  end_event_id: string | null;
  start_hour: number | null;
  end_hour: number | null;
  bg: string;
  border: string;
  z_index: number | null;
}>;

type TripSpanRow = Flat<RowMeta & {
  position: number;
  label: string | null;
  start_event_id: string;
  end_event_id: string;
  bg: string;
  border: string;
  z_index: number | null;
}>;

type TripExpenseRow = Flat<RowMeta & {
  position: number;
  label: string;
  amount: number;
  currency: "USD" | "COP" | null;
  split_mode: "group" | "perPerson" | null;
  linked_event_id: string | null;
  start_day_id: string | null;
  end_day_id: string | null;
}>;

type TripTaskRow = Flat<RowMeta & {
  position: number;
  title: string;
  done: boolean;
  note: string | null;
  day_id: string | null;
  start_hour: number | null;
  end_hour: number | null;
  cat: string | null;
  priority: "alta" | "media" | "baja" | null;
}>;

type TripTaskOptionRow = Flat<RowMeta & {
  task_id: string;
  position: number;
  label: string;
  note: string | null;
  amount: number | null;
  currency: "USD" | "COP" | null;
  split_mode: "group" | "perPerson" | null;
}>;

type TripTravelerRow = Flat<RowMeta & {
  position: number;
  name: string;
}>;

type TripChangeRow = {
  id: number;
  room_code: string;
  table_name: string;
  row_id: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  before: Json | null;
  after: Json | null;
  user_id: string | null;
  created_at: string;
};

type DayFk<T extends string, C extends string> = Relationship<`${T}_room_code_${C}_fkey`, ["room_code", C], "trip_days", ["room_code", "id"]>;
type EventFk<T extends string, C extends string> = Relationship<`${T}_room_code_${C}_fkey`, ["room_code", C], "trip_events", ["room_code", "id"]>;

export type Database = {
  public: {
    Tables: {
      rooms: TableOf<RoomRow, "payload" | "updated_at" | "name" | "members" | "destination" | "start_date" | "end_date" | "exchange_rate", []>;
      user_rooms: TableOf<UserRoomRow, "role" | "joined_at" | "last_active_at", [RoomFk<"user_rooms">]>;
      agent_usage: TableOf<AgentUsageRow, "id" | "input_tokens" | "output_tokens" | "created_at", []>;
      trip_days: TableOf<TripDayRow, MetaDefaults | "position" | "sub" | "flexible", [RoomFk<"trip_days">]>;
      trip_events: TableOf<
        TripEventRow,
        MetaDefaults | "position" | "note",
        [RoomFk<"trip_events">, DayFk<"trip_events", "day_id">]
      >;
      trip_day_spans: TableOf<
        TripDaySpanRow,
        MetaDefaults | "position" | "label" | "start_event_id" | "end_event_id" | "start_hour" | "end_hour" | "z_index",
        [
          RoomFk<"trip_day_spans">,
          DayFk<"trip_day_spans", "day_id">,
          EventFk<"trip_day_spans", "start_event_id">,
          EventFk<"trip_day_spans", "end_event_id">,
        ]
      >;
      trip_spans: TableOf<
        TripSpanRow,
        MetaDefaults | "position" | "label" | "z_index",
        [RoomFk<"trip_spans">, EventFk<"trip_spans", "start_event_id">, EventFk<"trip_spans", "end_event_id">]
      >;
      trip_expenses: TableOf<
        TripExpenseRow,
        MetaDefaults | "position" | "currency" | "split_mode" | "linked_event_id" | "start_day_id" | "end_day_id",
        [
          RoomFk<"trip_expenses">,
          EventFk<"trip_expenses", "linked_event_id">,
          DayFk<"trip_expenses", "start_day_id">,
          DayFk<"trip_expenses", "end_day_id">,
        ]
      >;
      trip_tasks: TableOf<
        TripTaskRow,
        MetaDefaults | "position" | "done" | "note" | "day_id" | "start_hour" | "end_hour" | "cat" | "priority",
        [RoomFk<"trip_tasks">, DayFk<"trip_tasks", "day_id">]
      >;
      trip_task_options: TableOf<
        TripTaskOptionRow,
        MetaDefaults | "position" | "note" | "amount" | "currency" | "split_mode",
        [
          RoomFk<"trip_task_options">,
          Relationship<"trip_task_options_room_code_task_id_fkey", ["room_code", "task_id"], "trip_tasks", ["room_code", "id"]>,
        ]
      >;
      trip_travelers: TableOf<TripTravelerRow, MetaDefaults | "position", [RoomFk<"trip_travelers">]>;
      trip_changes: TableOf<TripChangeRow, "id" | "before" | "after" | "user_id" | "created_at", [RoomFk<"trip_changes">]>;
    };
    Views: { [_ in never]: never };
    Functions: {
      join_room: {
        Args: { p_code: string; p_user: string; p_name: string; p_avatar: string; p_role?: string };
        Returns: Json;
      };
      leave_room: { Args: { p_code: string; p_user: string }; Returns: Json };
      delete_room: { Args: { p_code: string }; Returns: undefined };
      get_trip: { Args: { p_code: string }; Returns: Json };
      swap_days: { Args: { p_code: string; p_a: string; p_b: string; p_user: string }; Returns: Json };
      reset_itinerary: { Args: { p_code: string; p_days: Json; p_user: string }; Returns: Json };
      delete_trip_row: {
        Args: { p_table: TripTable; p_code: string; p_id: string; p_expected_version: number | null; p_user: string | null };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database["public"]["Tables"];
export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]["Insert"];
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]["Update"];

export type TripTable =
  | "trip_days"
  | "trip_events"
  | "trip_day_spans"
  | "trip_spans"
  | "trip_expenses"
  | "trip_tasks"
  | "trip_task_options"
  | "trip_travelers";

export type {
  RoomRow,
  TripDayRow,
  TripEventRow,
  TripDaySpanRow,
  TripSpanRow,
  TripExpenseRow,
  TripTaskRow,
  TripTaskOptionRow,
  TripTravelerRow,
  TripChangeRow,
};
