import { version } from "maplibre-gl/package.json";

// Published by scripts/copy-maplibre-worker.mjs; the bundle can't serve them.
const VENDOR = `/vendor/maplibre-${version}`;
export const MAPLIBRE_WORKER_URL = `${VENDOR}/maplibre-gl-worker.mjs`;
export const MAPLIBRE_FILES = [MAPLIBRE_WORKER_URL, `${VENDOR}/maplibre-gl-shared.mjs`];
