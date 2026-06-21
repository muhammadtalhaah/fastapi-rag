import apiClient from "./client";
import { ENDPOINTS } from "./endpoints";

// Backend calls only. The query endpoint is single-turn: it takes a question
// plus top_k and returns an answer with its source chunks.
const askQuestion = (question, topK) =>
  apiClient.post(ENDPOINTS.QUERY, { question, top_k: topK });

export default { askQuestion };
