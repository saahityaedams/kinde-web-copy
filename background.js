chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "kindleCopy",
    title: "Copy Text from Screen",
    contexts: ["page"],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "kindleCopy") {
    chrome.tabs.sendMessage(tab.id, { action: "performOCR" });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "takeScreenshot") {
    // Take screenshot of the current tab
    chrome.tabs
      .captureVisibleTab(null, { format: "png" })
      .then((dataUrl) => {
        sendResponse({ dataUrl: dataUrl });
      })
      .catch((error) => {
        console.error("Screenshot error:", error);
        sendResponse({ error: error.message });
      });

    return true; // Will respond asynchronously
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "perform-ocr") {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "performOCR" });
      }
    });
  }
});
