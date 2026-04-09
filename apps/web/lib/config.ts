function normalizeBaseUrl(value: string | undefined, fallback: string) {
  const candidate = value?.trim() || fallback;
  return candidate.replace(/\/+$/, "");
}

export const apiBaseUrl = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_REALTIME_URL,
  "http://localhost:4001",
);

export const socketBaseUrl = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_REALTIME_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL,
  "http://localhost:4001",
);
