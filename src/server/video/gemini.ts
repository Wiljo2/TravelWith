import { ANALYSIS_SCHEMA, analysisPrompt, parseAnalysis, type VideoAnalysis } from "@/server/video/analysis";
import { videoConfig } from "@/server/video/config";

// Gemini watches the video (image + audio) through the REST API. Non-YouTube
// videos go through the Files API: uploaded, analyzed, and deleted right after
// (Google also drops them after 48 h). YouTube links are passed as they are.

const API = "https://generativelanguage.googleapis.com";
const PROCESSING_TIMEOUT_MS = 120_000;

export type VideoInput =
  | { kind: "bytes"; data: Uint8Array<ArrayBuffer>; mime: string }
  | { kind: "youtube"; url: string };

export interface GeminiUsage {
  input: number;
  output: number;
  thinking: number;
}

export interface GeminiResult {
  analysis: VideoAnalysis;
  model: string;
  attempts: number;
  usage: GeminiUsage;
}

// Retryable: the model is overloaded (503/429/500) or the network failed.
export class GeminiBusyError extends Error {
  constructor(message: string, readonly attempts: number) {
    super(message);
  }
}

export class GeminiError extends Error {}

interface GeminiFile { name: string; uri: string; mimeType: string; state: string }

const key = () => videoConfig().geminiKey!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const busy = (status: number) => status === 429 || status === 500 || status === 503;

async function uploadFile(data: Uint8Array<ArrayBuffer>, mime: string): Promise<GeminiFile> {
  const start = await fetch(`${API}/upload/v1beta/files?key=${key()}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(data.byteLength),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "idea-video" } }),
    signal: AbortSignal.timeout(30_000),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new GeminiError(`upload start ${start.status}`);
  const done = await fetch(uploadUrl, {
    method: "POST",
    headers: { "X-Goog-Upload-Command": "upload, finalize", "X-Goog-Upload-Offset": "0" },
    body: data,
    signal: AbortSignal.timeout(60_000),
  });
  if (!done.ok) throw new GeminiError(`upload ${done.status}`);
  let { file } = (await done.json()) as { file: GeminiFile };
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
  while (file.state === "PROCESSING") {
    if (Date.now() > deadline) throw new GeminiError("video processing timed out");
    await sleep(2000);
    file = (await (await fetch(`${API}/v1beta/${file.name}?key=${key()}`)).json()) as GeminiFile;
  }
  if (file.state !== "ACTIVE") throw new GeminiError(`video file ${file.state}`);
  return file;
}

async function deleteFile(file: GeminiFile) {
  await fetch(`${API}/v1beta/${file.name}?key=${key()}`, { method: "DELETE" }).catch(() => {});
}

async function generate(model: string, part: object, places: string[], timeoutMs: number) {
  const res = await fetch(`${API}/v1beta/models/${model}:generateContent?key=${key()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [part, { text: analysisPrompt(places) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: ANALYSIS_SCHEMA },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  if (!res.ok) return { status: res.status, message: body.error?.message ?? `HTTP ${res.status}` } as const;
  const raw = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // handled below as an unreadable answer
  }
  const u = body.usageMetadata ?? {};
  return {
    status: 200,
    analysis: parseAnalysis(parsed),
    usage: { input: u.promptTokenCount ?? 0, output: u.candidatesTokenCount ?? 0, thinking: u.thoughtsTokenCount ?? 0 },
  } as const;
}

const MIN_CALL_MS = 30_000;

// Tries the main model twice with backoff, then the fallback model once, while
// time remains before `deadline` (epoch ms); out of time counts as busy.
export async function watchVideo(input: VideoInput, places: string[], deadline: number): Promise<GeminiResult> {
  const { model, fallbackModel } = videoConfig();
  const plan = [model, model, fallbackModel].filter((m): m is string => !!m);
  let file: GeminiFile | null = null;
  let attempts = 0;
  let lastError = "";
  try {
    const part = input.kind === "youtube"
      ? { file_data: { file_uri: input.url } }
      : { file_data: { file_uri: (file = await uploadFile(input.data, input.mime)).uri, mime_type: file.mimeType } };
    for (const [i, m] of plan.entries()) {
      const left = deadline - Date.now();
      if (left < MIN_CALL_MS) break;
      attempts++;
      const r = await generate(m, part, places, left);
      if (r.status === 200) {
        if (!r.analysis) throw new GeminiError("unreadable answer");
        return { analysis: r.analysis, model: m, attempts, usage: r.usage };
      }
      lastError = `${m} ${r.status}: ${r.message}`;
      if (!busy(r.status)) throw new GeminiError(lastError);
      if (i < plan.length - 1) await sleep(4000 * (i + 1));
    }
    throw new GeminiBusyError(lastError || "out of time", attempts);
  } finally {
    if (file) await deleteFile(file);
  }
}
