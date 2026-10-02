const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const cameraStatus = document.getElementById("cameraStatus");
const detectStatus = document.getElementById("detectStatus");
const placeholder = document.getElementById("placeholder");
const resultsList = document.getElementById("resultsList");
const objectCount = document.getElementById("objectCount");

let model = null;
let stream = null;
let detecting = false;
let animationId = null;
let lastDetectTime = 0;

// For smooth browser performance
const DETECT_EVERY_MS = 250;

async function loadModel() {
  try {
    detectStatus.textContent = "Loading TensorFlow model…";

    await tf.ready();

    model = await cocoSsd.load({
      base: "lite_mobilenet_v2"
    });

    detectStatus.textContent = "TensorFlow model ready";
    resultsList.innerHTML =
      '<div class="empty-state">Start the camera to begin detection.</div>';

  } catch (error) {
    console.error("Model loading error:", error);
    detectStatus.textContent = "Model failed to load";
    resultsList.innerHTML =
      '<div class="empty-state">TensorFlow model could not be loaded.</div>';
  }
}

async function startCamera() {
  if (!model) {
    detectStatus.textContent = "Please wait for the model to load.";
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 960 },
        height: { ideal: 540 }
      },
      audio: false
    });

    video.srcObject = stream;

    await new Promise(resolve => {
      video.onloadedmetadata = resolve;
    });

    await video.play();

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    placeholder.classList.add("hidden");

    cameraStatus.textContent = "Camera live";
    cameraStatus.className = "status live";

    startBtn.disabled = true;
    stopBtn.disabled = false;

    detecting = true;
    detectLoop();

  } catch (error) {
    console.error("Camera error:", error);

    cameraStatus.textContent = "Camera unavailable";
    cameraStatus.className = "status error";
    detectStatus.textContent =
      "Please allow camera permission in your browser.";
  }
}

function stopCamera() {
  detecting = false;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  video.srcObject = null;

  ctx.clearRect(0, 0, overlay.width, overlay.height);

  placeholder.classList.remove("hidden");

  cameraStatus.textContent = "Camera off";
  cameraStatus.className = "status offline";

  detectStatus.textContent = "TensorFlow model ready";

  startBtn.disabled = false;
  stopBtn.disabled = true;

  objectCount.textContent = "0";

  resultsList.innerHTML =
    '<div class="empty-state">Start the camera to begin detection.</div>';
}

async function detectLoop(timestamp = 0) {
  if (!detecting || !model || !stream) {
    return;
  }

  if (
    video.readyState >= 2 &&
    timestamp - lastDetectTime >= DETECT_EVERY_MS
  ) {
    lastDetectTime = timestamp;

    try {
      const predictions = await model.detect(video);

      drawPredictions(predictions);
      renderResults(predictions);

      detectStatus.textContent =
        predictions.length === 1
          ? "1 object detected"
          : `${predictions.length} objects detected`;

    } catch (error) {
      console.error("Detection error:", error);
      detectStatus.textContent = "Detection error";
    }
  }

  animationId = requestAnimationFrame(detectLoop);
}

function drawPredictions(predictions) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  ctx.lineWidth = Math.max(3, overlay.width / 320);
  ctx.font = `${Math.max(16, overlay.width / 45)}px Arial`;

  predictions.forEach(prediction => {
    const [x, y, width, height] = prediction.bbox;
    const confidence = (prediction.score * 100).toFixed(1);
    const label = `${prediction.class} ${confidence}%`;

    ctx.strokeStyle = "#7c3aed";
    ctx.fillStyle = "#7c3aed";

    ctx.strokeRect(x, y, width, height);

    const textWidth = ctx.measureText(label).width + 16;
    const textHeight = Math.max(26, overlay.width / 35);
    const labelY = Math.max(0, y - textHeight);

    ctx.fillRect(x, labelY, textWidth, textHeight);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      label,
      x + 8,
      labelY + textHeight * 0.72
    );
  });
}

function renderResults(predictions) {
  objectCount.textContent = predictions.length;

  if (!predictions.length) {
    resultsList.innerHTML =
      '<div class="empty-state">No objects detected in this frame.</div>';
    return;
  }

  const sorted = [...predictions].sort(
    (a, b) => b.score - a.score
  );

  resultsList.innerHTML = sorted
    .map(item => `
      <div class="result-item">
        <div>
          <strong>${escapeHtml(item.class)}</strong>
          <span>TensorFlow COCO class</span>
        </div>
        <div class="confidence">
          ${(item.score * 100).toFixed(1)}%
        </div>
      </div>
    `)
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);

loadModel();
