// app/lib/openaiClient.ts
// Lazy-initialized so importing this module never crashes the server.
// The error surfaces only when getOpenAI() is actually called — at that
// point a missing key is a clear, actionable runtime failure, not a
// silent boot-time crash unrelated to the failing request.

import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to your environment variables before using OpenAI features."
      );
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
}
