import httpError from "../utils/httpError.js";
import { embeddingFromDataUrl } from "../services/faceRecognitionService.js";

const syntheticImage = () => {
  const width = 100;
  const height = 100;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const imageSize = rowSize * height;
  const bitmap = Buffer.alloc(54 + imageSize);
  bitmap.write("BM", 0);
  bitmap.writeUInt32LE(bitmap.length, 2);
  bitmap.writeUInt32LE(54, 10);
  bitmap.writeUInt32LE(40, 14);
  bitmap.writeInt32LE(width, 18);
  bitmap.writeInt32LE(height, 22);
  bitmap.writeUInt16LE(1, 26);
  bitmap.writeUInt16LE(24, 28);
  bitmap.writeUInt32LE(imageSize, 34);
  bitmap.fill(255, 54);
  return bitmap.toString("base64");
};

export async function deepRecognitionHealth(req, res) {
  try {
    await embeddingFromDataUrl(syntheticImage());
    throw httpError(500, "Recognition validation unexpectedly accepted an invalid image");
  } catch (error) {
    if (error.status === 422 && /no face/i.test(error.message)) {
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
