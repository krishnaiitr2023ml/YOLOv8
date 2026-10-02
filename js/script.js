const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const overlayCtx = overlay.getContext("2d");
const captureCanvas = document.getElementById("captureCanvas");
const captureCtx = captureCanvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const cameraStatus = document.getElementById("cameraStatus");
const detectStatus = document.getElementById("detectStatus");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const resultsList = document.getElementById("resultsList");
const objectCount = document.getElementById("objectCount");

let stream = null;
let detectionTimer = null;
let requestInFlight = false;
const DETECTION_INTERVAL = 700;

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    await new Promise(resolve => video.onloadedmetadata = resolve);
    await video.play();

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;

    cameraPlaceholder.classList.add("hidden");
    cameraStatus.textContent = "Camera live";
    cameraStatus.className = "status live";
    detectStatus.textContent = "YOLO detection active";
    startBtn.disabled = true;
    stopBtn.disabled = false;

    detectionTimer = setInterval(captureAndDetect, DETECTION_INTERVAL);
    captureAndDetect();
  } catch (error) {
    cameraStatus.textContent = "Permission denied";
    cameraStatus.className = "status error";
    detectStatus.textContent = "Allow camera access in your browser.";
  }
}

function stopCamera() {
  if (detectionTimer) clearInterval(detectionTimer);
  detectionTimer = null;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  overlayCtx.clearRect(0,0,overlay.width,overlay.height);
  cameraPlaceholder.classList.remove("hidden");
  cameraStatus.textContent = "Camera off";
  cameraStatus.className = "status offline";
  detectStatus.textContent = "Waiting for camera…";
  startBtn.disabled = false;
  stopBtn.disabled = true;
  resultsList.innerHTML = '<div class="empty-state">No objects detected yet.</div>';
  objectCount.textContent = "0";
}

async function captureAndDetect() {
  if (!stream || requestInFlight || video.readyState < 2) return;
  requestInFlight = true;
  detectStatus.textContent = "Detecting…";
  try {
    captureCtx.drawImage(video,0,0,captureCanvas.width,captureCanvas.height);
    const blob = await new Promise(resolve => captureCanvas.toBlob(resolve,"image/jpeg",0.78));
    const formData = new FormData();
    formData.append("file", blob, "camera-frame.jpg");
    const response = await fetch("/api/detect", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Detection failed.");
    drawDetections(data.detections || []);
    renderResults(data.detections || []);
    detectStatus.textContent = data.count === 1 ? "1 object detected" : `${data.count} objects detected`;
  } catch (error) {
    detectStatus.textContent = "Detection error";
  } finally {
    requestInFlight = false;
  }
}

function drawDetections(detections) {
  overlayCtx.clearRect(0,0,overlay.width,overlay.height);
  overlayCtx.lineWidth = Math.max(3, overlay.width / 320);
  overlayCtx.font = `${Math.max(16, overlay.width / 45)}px Arial`;
  detections.forEach(item => {
    const {x1,y1,x2,y2} = item.box;
    const w = x2-x1, h = y2-y1;
    const text = `${item.class} ${item.confidence}%`;
    overlayCtx.strokeStyle = "#7c3aed";
    overlayCtx.fillStyle = "#7c3aed";
    overlayCtx.strokeRect(x1,y1,w,h);
    const tw = overlayCtx.measureText(text).width + 16;
    const th = Math.max(26, overlay.width / 35);
    const ly = Math.max(0, y1-th);
    overlayCtx.fillRect(x1,ly,tw,th);
    overlayCtx.fillStyle = "#fff";
    overlayCtx.fillText(text,x1+8,ly+th*0.72);
  });
}

function renderResults(detections) {
  objectCount.textContent = detections.length;
  if (!detections.length) {
    resultsList.innerHTML = '<div class="empty-state">No objects detected in this frame.</div>';
    return;
  }
  resultsList.innerHTML = detections.sort((a,b)=>b.confidence-a.confidence).map(item => `
    <div class="result-item">
      <div><strong>${escapeHtml(item.class)}</strong><span>COCO class ${item.class_id}</span></div>
      <div class="confidence">${item.confidence}%</div>
    </div>`).join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
