from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
from PIL import Image
import io
import os
import numpy as np

app = FastAPI(title="YOLO Live Camera Object Detection", version="1.0")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/css", StaticFiles(directory=os.path.join(BASE_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(BASE_DIR, "js")), name="js")

model = YOLO("yolov8n.pt")

@app.get("/")
def home():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/health")
def health():
    return {"status": "healthy", "model": "YOLOv8n", "task": "object detection"}

@app.post("/api/detect")
async def detect(file: UploadFile = File(...)):
    if file.content_type is None or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please send an image frame.")
    try:
        raw = await file.read()
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        image_np = np.asarray(image)
        results = model.predict(source=image_np, imgsz=640, conf=0.35, verbose=False)
        result = results[0]
        detections = []
        if result.boxes is not None:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                label = model.names[class_id]
                detections.append({
                    "class_id": class_id,
                    "class": label,
                    "confidence": round(confidence * 100, 2),
                    "box": {"x1": round(x1,2), "y1": round(y1,2), "x2": round(x2,2), "y2": round(y2,2)}
                })
        return {"width": image.width, "height": image.height, "count": len(detections), "detections": detections}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(exc)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
