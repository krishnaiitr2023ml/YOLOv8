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
const fpsInfo = document.getElementById("fpsInfo");

let stream = null;
let detectionTimer = null;
let requestInFlight = false;
let lastRequestStarted = 0;

const DETECTION_INTERVAL = 1500;
const CAPTURE_WIDTH = 480;

if (fpsInfo) {
  fpsInfo.textContent = `Detection interval: ${DETECTION_INTERVAL} ms`;
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);

async function startCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera access is not supported in this browser.");
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 960 },
        height: { ideal: 540 }
      },
      audio: false
    });

    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = resolve;
    });

    await video.play();

    updateCanvasSizes();

    cameraPlaceholder.classList.add("hidden");
    cameraStatus.textContent = "Camera live";
    cameraStatus.className = "status live";
    detectStatus.textContent = "YOLO detection active";

    startBtn.disabled = true;
    stopBtn.disabled = false;

    // First detection immediately
    captureAndDetect();

    // Continue at CPU-friendly interval
    detectionTimer = setInterval(
      captureAndDetect,
      DETECTION_INTERVAL
    );

  } catch (error) {
    console.error("Camera error:", error);

    cameraStatus.textContent = "Camera unavailable";
    cameraStatus.className = "status error";
    detectStatus.textContent =
      error.message || "Please allow camera permission.";
  }
}

function updateCanvasSizes() {
  const sourceWidth = video.videoWidth || 640;
  const sourceHeight = video.videoHeight || 480;

  // Overlay must match the actual video coordinate system
  overlay.width = sourceWidth;
  overlay.height = sourceHeight;

  // Capture a smaller image for faster network transfer/inference
  const scale = Math.min(1, CAPTURE_WIDTH / sourceWidth);

  captureCanvas.width = Math.round(sourceWidth * scale);
  captureCanvas.height = Math.round(sourceHeight * scale);
}

function stopCamera() {
  if (detectionTimer) {
    clearInterval(detectionTimer);
    detectionTimer = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  video.srcObject = null;
  requestInFlight = false;

  overlayCtx.clearRect(
    0,
    0,
    overlay.width,
    overlay.height
  );

  cameraPlaceholder.classList.remove("hidden");

  cameraStatus.textContent = "Camera off";
  cameraStatus.className = "status offline";

  detectStatus.textContent = "Waiting for camera…";

  startBtn.disabled = false;
  stopBtn.disabled = true;

  resultsList.innerHTML =
    '<div class="empty-state">No objects detected yet.</div>';

  objectCount.textContent = "0";
}

async function captureAndDetect() {
  if (
    !stream ||
    requestInFlight ||
    video.readyState < 2
  ) {
    return;
  }

  requestInFlight = true;
  lastRequestStarted = performance.now();

  detectStatus.textContent = "Detecting…";

  try {
    captureCtx.drawImage(
      video,
      0,
      0,
      captureCanvas.width,
      captureCanvas.height
    );

    const blob = await new Promise((resolve) => {
      captureCanvas.toBlob(
        resolve,
        "image/jpeg",
        0.65
      );
    });

    if (!blob) {
      throw new Error("Could not capture camera frame.");
    }

    const formData = new FormData();
    formData.append(
      "file",
      blob,
      "camera-frame.jpg"
    );

    const controller = new AbortController();

    // Avoid requests hanging forever
    const timeoutId = setTimeout(
      () => controller.abort(),
      12000
    );

    const response = await fetch("/api/detect", {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || "Detection failed."
      );
    }

    drawDetections(
      data.detections || [],
      data.width,
      data.height
    );

    renderResults(
      data.detections || []
    );

    const elapsed = Math.round(
      performance.now() - lastRequestStarted
    );

    detectStatus.textContent =
      data.count === 1
        ? `1 object detected • ${elapsed} ms`
        : `${data.count} objects detected • ${elapsed} ms`;

  } catch (error) {
    console.error("Detection error:", error);

    if (error.name === "AbortError") {
      detectStatus.textContent =
        "Server response timed out";
    } else {
      detectStatus.textContent =
        error.message || "Detection error";
    }

  } finally {
    requestInFlight = false;
  }
}

function drawDetections(
  detections,
  detectionWidth,
  detectionHeight
) {
  overlayCtx.clearRect(
    0,
    0,
    overlay.width,
    overlay.height
  );

  if (
    !detectionWidth ||
    !detectionHeight
  ) {
    return;
  }

  const scaleX =
    overlay.width / detectionWidth;

  const scaleY =
    overlay.height / detectionHeight;

  overlayCtx.lineWidth =
    Math.max(3, overlay.width / 300);

  overlayCtx.font =
    `${Math.max(16, overlay.width / 42)}px Arial`;

  detections.forEach((item) => {
    const x1 = item.box.x1 * scaleX;
    const y1 = item.box.y1 * scaleY;
    const x2 = item.box.x2 * scaleX;
    const y2 = item.box.y2 * scaleY;

    const boxWidth = x2 - x1;
    const boxHeight = y2 - y1;

    const text =
      `${item.class} ${item.confidence}%`;

    overlayCtx.strokeStyle = "#7c3aed";
    overlayCtx.fillStyle = "#7c3aed";

    overlayCtx.strokeRect(
      x1,
      y1,
      boxWidth,
      boxHeight
    );

    const textMetrics =
      overlayCtx.measureText(text);

    const textWidth =
      textMetrics.width + 16;

    const textHeight =
      Math.max(
        27,
        overlay.width / 34
      );

    const labelY =
      Math.max(
        0,
        y1 - textHeight
      );

    overlayCtx.fillRect(
      x1,
      labelY,
      textWidth,
      textHeight
    );

    overlayCtx.fillStyle = "#ffffff";

    overlayCtx.fillText(
      text,
      x1 + 8,
      labelY + textHeight * 0.72
    );
  });
}

function renderResults(detections) {
  objectCount.textContent =
    detections.length;

  if (!detections.length) {
    resultsList.innerHTML =
      '<div class="empty-state">No objects detected in this frame.</div>';

    return;
  }

  const sorted = [...detections].sort(
    (a, b) =>
      b.confidence - a.confidence
  );

  resultsList.innerHTML = sorted
    .map((item) => `
      <div class="result-item">
        <div>
          <strong>${escapeHtml(item.class)}</strong>
          <span>COCO class ${item.class_id}</span>
        </div>
        <div class="confidence">
          ${item.confidence}%
        </div>
      </div>
    `)
    .join("");
}

function escapeHtml(text) {
  const div =
    document.createElement("div");

  div.textContent = text;

  return div.innerHTML;
}
