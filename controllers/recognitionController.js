import httpError from "../utils/httpError.js";
import { embeddingFromDataUrl } from "../services/faceRecognitionService.js";

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
