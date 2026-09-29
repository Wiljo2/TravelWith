// 32 symbols without look-alikes (0/O, 1/I), so each random byte maps to a
// symbol with `& 31` and no modulo bias. 10 symbols = 50 bits of entropy.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 10;

export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b & 31]).join("");
}
