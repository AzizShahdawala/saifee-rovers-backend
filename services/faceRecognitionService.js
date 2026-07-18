import fs from "fs/promises";
import httpError from "../utils/httpError.js";

const serviceUrl = () => process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

async function requestEmbedding(image) {
  let response;
  try {
    response = await fetch(`${serviceUrl()}/embedding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw httpError(503, "Face recognition service is unavailable. Restart the backend with: npm run dev");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response.status, result.detail || "Face processing failed");
  return result;
}

export async function embeddingFromDataUrl(image) {
  return requestEmbedding(image);
}

export async function embeddingFromFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return requestEmbedding(buffer.toString("base64"));
}

export async function enrollmentDescriptor(filePaths) {
  const results = await Promise.allSettled(filePaths.map((filePath) => embeddingFromFile(filePath)));
  const embeddings = results.filter((result) => result.status === "fulfilled").map((result) => result.value.embedding);
  if (embeddings.length < 1) {
    const unavailable = results.find((result) => result.status === "rejected" && result.reason?.status === 503)?.reason;
    if (unavailable) throw unavailable;
    const reason = results.find((result) => result.status === "rejected")?.reason?.message;
    throw httpError(422, `At least one clear enrollment photo must contain one detectable face${reason ? `: ${reason}` : ""}`);
  }
  return { descriptor: averageEmbeddings(embeddings), acceptedImages: embeddings.length };
}

export async function recognitionServiceHealth() {
  try {
    const response = await fetch(`${serviceUrl()}/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("Health check failed");
    return await response.json();
  } catch {
    throw httpError(503, "Face recognition service is unavailable. Restart the backend with: npm run dev");
  }
}

export function averageEmbeddings(embeddings) {
  if (!embeddings.length) throw httpError(422, "No face embeddings were generated");
  const average = embeddings[0].map((_, index) => embeddings.reduce((sum, vector) => sum + vector[index], 0) / embeddings.length);
  const norm = Math.sqrt(average.reduce((sum, value) => sum + value * value, 0));
  return average.map((value) => value / norm);
}

export function cosineSimilarity(left, right) {
  if (!left?.length || left.length !== right?.length) return -1;
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}
