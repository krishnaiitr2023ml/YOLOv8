from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
from PIL import Image
import io
import os
import numpy as np

app = FastAPI(
    title="YOLO Live Camera Object Detection",
    description="Optimized browser-camera object detection using YOLO and FastAPI",
    version="1.1"
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Serve existing frontend folders
CSS_DIR = os.path.join(BASE_DIR, "css")
JS_DIR = os.path.join(BASE_DIR, "js")

if os.path.isdir(CSS_DIR):
    app.mount("/css", StaticFiles(directory=CSS_DIR), name="css")

if os.path.isdir(JS_DIR):
    app.mount("/js", StaticFiles(directory=JS_DIR), name="js")

# Lightweight pretrained model
model = YOLO("yolov8n.pt")


@app.get("/")
def home():
    index_file = os.path.join(BASE_DIR, "index.html")

    if os.path.exists(index_file):
        return FileResponse(index_file)

    return {"status": "ok", "message": "YOLO detector is running"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "YOLOv8n",
        "task": "object detection",
        "imgsz": 320,
        "confidence_threshold": 0.35
    }


@app.post("/api/detect")
async def detect(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please send a valid image frame."
        )

    try:
        raw = await file.read()

        if not raw:
            raise HTTPException(status_code=400, detail="Empty image frame.")

        image = Image.open(io.BytesIO(raw)).convert("RGB")

        # Downscale very large camera frames before inference.
        # Bounding boxes are returned relative to this resized image.
        max_side = 640
        width, height = image.size

        if max(width, height) > max_side:
            scale = max_side / max(width, height)
            new_size = (
                max(1, int(width * scale)),
                max(1, int(height * scale))
            )
            image = image.resize(new_size, Image.Resampling.BILINEAR)

        image_np = np.asarray(image)

        results = model.predict(
            source=image_np,
            imgsz=320,       # optimized for Render CPU
            conf=0.35,
            iou=0.45,
            max_det=20,
            verbose=False,
            device="cpu"
        )

        result = results[0]
        detections = []

        if result.boxes is not None:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])

                detections.append({
                    "class_id": class_id,
                    "class": model.names[class_id],
                    "confidence": round(confidence * 100, 2),
                    "box": {
                        "x1": round(x1, 2),
                        "y1": round(y1, 2),
                        "x2": round(x2, 2),
                        "y2": round(y2, 2)
                    }
                })

        return {
            "width": image.width,
            "height": image.height,
            "count": len(detections),
            "detections": detections
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Detection failed: {str(exc)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=False
    )
