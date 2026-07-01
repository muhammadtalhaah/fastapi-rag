// Dummy data + static option sets for the Settings modal. No backend yet — these
// stand in for what will eventually come from the user record and a usage API.
// Keeping them here (rather than inline in the components) means the UI reads as
// data-driven and the swap to real APIs later is a one-file change.

export const WORK_OPTIONS = [
  { value: "engineering", label: "Engineering" },
  { value: "research", label: "Research" },
  { value: "design", label: "Design" },
  { value: "product", label: "Product" },
  { value: "operations", label: "Operations" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
];

export const FONT_OPTIONS = [
  { value: "serif", label: "Athenæum Serif" },
  { value: "sans", label: "Inter Sans" },
  { value: "mono", label: "JetBrains Mono" },
];

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ur", label: "Urdu" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

// Accent swatches map to the archive palette's named tones. Stored as a token so
// the swatch dot and any future wiring stay in the app's color language.
export const ACCENT_OPTIONS = [
  { value: "brass", label: "Brass", token: "--brass" },
  { value: "retrieval", label: "Teal", token: "--retrieval" },
  { value: "danger", label: "Terracotta", token: "--danger" },
  { value: "ink", label: "Ink", token: "--ink" },
];

// Stand-in usage figures for the Usage tab. A single billing window's totals,
// broken down by the two model calls the RAG flow makes (embeddings + chat).
export const DUMMY_USAGE = {
  period: "June 2026",
  totalTokens: 1_284_530,
  limit: 2_000_000,
  breakdown: [
    { label: "Chat completion", model: "gpt-5.4", tokens: 942_180 },
    { label: "Embeddings", model: "voyage-4-large", tokens: 342_350 },
  ],
  requests: 1_472,
};
