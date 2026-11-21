export function formatGeminiError(err: unknown): {
  status: number;
  message: string;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("api_key_invalid") ||
    lower.includes("permission_denied") ||
    lower.includes("403") ||
    lower.includes("api key")
  ) {
    return {
      status: 403,
      message:
        "Gemini API key was rejected or missing. Please verify your key in .env.local.",
    };
  }
  if (lower.includes("resource_exhausted") || lower.includes("429")) {
    return {
      status: 429,
      message:
        "Rate limit or quota reached (429). Wait briefly, lower the frame cadence, or check your quota/paid key in .env.local.",
    };
  }
  if (lower.includes("not_found") || lower.includes("404")) {
    return {
      status: 404,
      message: `Requested Gemini model was not found: ${raw}`,
    };
  }
  return {
    status: 500,
    message: raw || "Unexpected error communicating with Gemini API.",
  };
}
