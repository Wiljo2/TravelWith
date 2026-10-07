// Google Drive links: only the file id is ever stored; Drive enforces access.

export const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

const DRIVE_HOST_RE = /^https?:\/\/(?:drive|docs)\.google\.com\//i;
const PATH_ID_RE = /\/(?:file|document|spreadsheets|presentation|forms)\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/;
const PARAM_ID_RE = /[?&]id=([A-Za-z0-9_-]+)/;

// Accepts a Drive/Docs share link or a bare file id; anything else → undefined.
export function parseDriveFileId(text: string): string | undefined {
  const t = text.trim();
  if (DRIVE_ID_RE.test(t)) return t;
  if (!DRIVE_HOST_RE.test(t)) return undefined;
  const id = t.match(PATH_ID_RE)?.[1] ?? t.match(PARAM_ID_RE)?.[1];
  return id && DRIVE_ID_RE.test(id) ? id : undefined;
}

export function driveFileUrl(driveFileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view`;
}
