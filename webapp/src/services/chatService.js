import { ENDPOINTS } from "@/api/endpoints";

function toSource(raw, index) {
  return {
    key: `${raw.document_id}-${raw.chunk_index}-${index}`,
    documentId: raw.document_id,
    filename: raw.filename,
    chunkIndex: raw.chunk_index,
    text: raw.text,
    score: raw.score,
    callNumber: deriveCallNumber(raw.filename, raw.chunk_index),
  };
}

function deriveCallNumber(filename, chunkIndex) {
  const stem = (filename || "DOC").replace(/\.[^.]+$/, "");
  const code = stem.slice(0, 3).toUpperCase().padEnd(3, "X");
  return `${code}·${String(chunkIndex).padStart(3, "0")}`;
}

// Parse raw SSE buffer into complete frames, returning { frames, remainder }.
function parseSSEBuffer(buffer) {
  const frames = [];
  const parts = buffer.split("\n\n");
  const remainder = parts.pop(); // last part may be incomplete
  for (const part of parts) {
    const eventMatch = part.match(/event: (.+)/);
    const dataMatch = part.match(/data: (.+)/);
    if (eventMatch && dataMatch) {
      try {
        frames.push({ event: eventMatch[1].trim(), data: JSON.parse(dataMatch[1]) });
      } catch {
        // malformed JSON — skip
      }
    }
  }
  return { frames, remainder };
}

// Stream a question to the backend SSE endpoint.
// Callbacks:
//   onStatus(stage, message)  — activity indicator ("embedding" | "searching" | "generating")
//   onSources(sources)        — source chunks available before generation starts
//   onToken(text)             — incremental answer text
//   onDone()                  — stream complete
//   onError(message)          — server or network error
export async function askStream(question, topK, { onStatus, onSources, onToken, onDone, onError }) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "";

  let response;
  try {
    response = await fetch(`${baseURL}${ENDPOINTS.QUERY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, top_k: topK }),
    });
  } catch (err) {
    onError?.(err.message || "Network error — check that the backend is running.");
    return;
  }

  if (!response.ok) {
    let detail = `Server error ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch { /* ignore */ }
    onError?.(detail);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch {
      onError?.("Connection lost while streaming.");
      return;
    }

    const { value, done } = chunk;
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { frames, remainder } = parseSSEBuffer(buffer);
    buffer = remainder;

    for (const { event, data } of frames) {
      if (event === "status") onStatus?.(data.stage, data.message);
      else if (event === "sources") onSources?.((data.sources || []).map(toSource));
      else if (event === "token") onToken?.(data.text);
      else if (event === "done") onDone?.();
      else if (event === "error") onError?.(data.message || "Unknown error from server.");
    }
  }
}
