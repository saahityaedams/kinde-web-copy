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

    const selections = document.querySelectorAll(".kg-selection");
    let selectionsByTop = {};
    selections.forEach((selection) => {
      let rect = selection.getBoundingClientRect();
      let top = rect.top + "px";
      if (!selectionsByTop[top]) {
        selectionsByTop[top] = [];
      }
      selectionsByTop[top].push(selection);
    });
    let rectangularBounds = {};
    Object.keys(selectionsByTop).forEach((top) => {
      let selections = selectionsByTop[top];
      let rects = selections.map((sel) => sel.getBoundingClientRect());
      let minLeft = Math.min(...rects.map((rect) => rect.left));
      let maxRight = Math.max(...rects.map((rect) => rect.right));
      rectangularBounds[top] = {
        top: parseFloat(top),
        left: minLeft,
        width: maxRight - minLeft,
        height: rects[0].height,
      };
    });
    const img = new Image();
    img.src = response.dataUrl;
    await new Promise((resolve) => (img.onload = resolve));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    let croppedDataUrls = [];

    for (let top in rectangularBounds) {
      const bounds = rectangularBounds[top];
      canvas.width = bounds.width;
      canvas.height = bounds.height;

      // Account for device pixel ratio
      const dpr = window.devicePixelRatio || 1;
      const scaledLeft = bounds.left * dpr;
      const scaledTop = bounds.top * dpr;
      const scaledWidth = bounds.width * dpr;
      const scaledHeight = bounds.height * dpr;

      ctx.drawImage(
        img,
        scaledLeft,
        scaledTop,
        scaledWidth,
        scaledHeight,
        0,
        0,
        bounds.width,
        bounds.height,
      );
      const croppedDataUrl = canvas.toDataURL();
      croppedDataUrls.push(croppedDataUrl);
      console.log(`Cropped image for top ${top}:`, croppedDataUrl);
    }
    console.log("Rectangular bounds:", rectangularBounds);
    console.log("Found selections:", selections);
    console.log("Found selections grouped by tops:", selectionsByTop);

    if (response && response.dataUrl) {
      if (croppedDataUrls.length > 0) {
        const textParts = await Promise.all(
          croppedDataUrls.map((url) => performOCR(url)),
        );
        const text = textParts.join(" ");
        await navigator.clipboard.writeText(text);
        return text;
      }
      const text = await performOCR(response.dataUrl);
      // Copy to clipboard
      await navigator.clipboard.writeText(text);
      return text;
    }
  } catch (error) {
    console.error("Capture and OCR Error:", error);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "performOCR") {
    captureAndOCR()
      .then((result) => {
        console.log("OCR Result:", result);
        alert("OCR completed! Text copied to clipboard."); // Simple notification
        // Optionally, you could copy the result to clipboard here
        // or show it in a popup
      })
      .catch((error) => console.error("Error:", error));
  }
});
