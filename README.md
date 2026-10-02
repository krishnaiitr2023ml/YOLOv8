# TensorFlow.js Live Camera Object Detection

This version performs object detection directly in the user's browser with TensorFlow.js and the pretrained COCO-SSD model.

Advantages for Render:
- No PyTorch
- No YOLO backend inference
- No large server-side model
- No `/api/detect` request loop
- Much lower Render memory/CPU usage

## Render

Build command:
`pip install -r requirements.txt`

Start command:
`uvicorn app:app --host 0.0.0.0 --port $PORT`

Open the deployed HTTPS URL and allow camera permission.
