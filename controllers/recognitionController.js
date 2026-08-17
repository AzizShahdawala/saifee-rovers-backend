import httpError from "../utils/httpError.js";
import { embeddingFromDataUrl } from "../services/faceRecognitionService.js";

const syntheticPixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7S8AAAAASUVORK5CYII=";

export async function deepRecognitionHealth(req, res) {
  try {
    await embeddingFromDataUrl(syntheticPixel);
    throw httpError(500, "Recognition validation unexpectedly accepted an invalid image");
  } catch (error) {
    if (error.status === 422 && /small/i.test(error.message)) {
      return res.json({ success: true, status: "ready", imagePipeline: "validated" });
    }
    throw error;
  }
}

export async function testRecognitionEmbedding(req, res) {
  if (!req.body.image) throw httpError(400, "A test image is required");
  const result = await embeddingFromDataUrl(req.body.image);
  res.json({
    success: true,
    service: "ready",
    embeddingDimensions: result.embedding?.length || 0,
    detectionConfidence: result.detectionConfidence,
    box: result.box,
  });
}
