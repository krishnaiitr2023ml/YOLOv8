from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(
    title="TensorFlow.js Live Camera Object Detection",
    description="Live browser-camera object detection using TensorFlow.js COCO-SSD",
    version="1.0"
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app.mount("/css", StaticFiles(directory=os.path.join(BASE_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(BASE_DIR, "js")), name="js")

@app.get("/")
def home():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "framework": "TensorFlow.js",
        "model": "COCO-SSD",
        "inference": "browser"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
