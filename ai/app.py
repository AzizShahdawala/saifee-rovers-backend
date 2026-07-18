import base64
import binascii
import threading
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
DETECTOR_PATH = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
RECOGNIZER_PATH = MODEL_DIR / "face_recognition_sface_2021dec.onnx"

if not DETECTOR_PATH.exists() or DETECTOR_PATH.stat().st_size == 0:
    raise RuntimeError(f"Missing face detector model: {DETECTOR_PATH}")
if not RECOGNIZER_PATH.exists() or RECOGNIZER_PATH.stat().st_size == 0:
    raise RuntimeError(f"Missing face recognition model: {RECOGNIZER_PATH}")

detector = cv2.FaceDetectorYN.create(str(DETECTOR_PATH), "", (320, 320), 0.85, 0.3, 5000)
recognizer = cv2.FaceRecognizerSF.create(str(RECOGNIZER_PATH), "")
model_lock = threading.Lock()
app = FastAPI(title="Saifee Rovers Face Service", version="1.0.0")


class ImageRequest(BaseModel):
    image: str


def decode_image(value: str) -> np.ndarray:
    encoded = value.split(",", 1)[1] if "," in value else value
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise HTTPException(400, "Invalid base64 image") from error
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Unable to decode image")
    return image


def extract_embedding(image: np.ndarray):
    height, width = image.shape[:2]
    if width < 80 or height < 80:
        raise HTTPException(422, "Image is too small")
    with model_lock:
        detector.setInputSize((width, height))
        _, faces = detector.detect(image)
        if faces is None or len(faces) == 0:
            raise HTTPException(422, "No face detected. Center the face and improve lighting")
        if len(faces) > 1:
            raise HTTPException(422, "Multiple faces detected. Keep only one person in frame")
        face = faces[0]
        aligned = recognizer.alignCrop(image, face)
        feature = recognizer.feature(aligned).flatten().astype(np.float32)
    norm = float(np.linalg.norm(feature))
    if norm == 0:
        raise HTTPException(422, "Unable to generate a face embedding")
    feature /= norm
    box = [round(float(value), 2) for value in face[:4]]
    return feature.tolist(), float(face[-1]), box


@app.get("/health")
def health():
    return {"success": True, "status": "ready", "detector": "YuNet", "recognizer": "SFace"}


@app.post("/embedding")
def embedding(request: ImageRequest):
    vector, confidence, box = extract_embedding(decode_image(request.image))
    return {"success": True, "embedding": vector, "detectionConfidence": confidence, "box": box}
