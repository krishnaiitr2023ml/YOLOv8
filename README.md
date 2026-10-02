# YOLO Live Camera Object Detection

Browser webcam -> FastAPI -> YOLOv8n -> live bounding boxes.

## Run locally
```bash
pip install -r requirements.txt
uvicorn app:app --reload
```
Open http://127.0.0.1:8000 and allow camera access.

## Render
Build command: `pip install -r requirements.txt`

Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

Note: YOLO/PyTorch can exceed very small free-instance RAM limits.
