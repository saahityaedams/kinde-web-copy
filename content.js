console.log("Content script loaded");

async function createWorker() {
  const worker = await Tesseract.createWorker("eng", 1, {
    workerPath: chrome.runtime.getURL(
      "tesseract/tesseract.js@v5.0.4_dist_worker.min.js",
    ),
    corePath: chrome.runtime.getURL("tesseract/"),
    langPath: chrome.runtime.getURL("tesseract/languages/"),
    logger: (m) => {
      console.log(m);
    },
  });
  await worker.setParameters({
    preserve_interword_spaces: "1",
  });
  return worker;
}

async function performOCR(dataUrl) {
  try {
    const worker = await createWorker();
    const { data } = await worker.recognize(dataUrl);
    console.log("OCR Result:", data.text);
    return data.text;
  } catch (error) {
    console.error("OCR Error:", error);
    throw error;
  }
}

// New function to capture screenshot and perform OCR
async function captureAndOCR() {
  try {
    // Send message to background script to take screenshot
    const response = await chrome.runtime.sendMessage({
      action: "takeScreenshot",
    });
    console.log("Screenshot response:", response); // Debug log
    if (response && response.dataUrl) {
      const text = await performOCR(response.dataUrl);
      return text;
    }
  } catch (error) {
    console.error("Capture and OCR Error:", error);
    throw error;
  }
}

setTimeout(() => {
  captureAndOCR()
    .then((result) => console.log("OCR Result:", result))
    .catch((error) => console.error("Error:", error));
}, 10000);
