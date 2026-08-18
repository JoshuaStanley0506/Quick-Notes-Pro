// Register the context menu on install or update
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveToQuickNotes",
    title: "Save to Quick Notes",
    contexts: ["selection"]
  });
});

// Handle right-click context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveToQuickNotes" && info.selectionText) {
    const pageTitle = tab?.title || "Webpage";
    const pageUrl = tab?.url || "";

    // Format clipped text as a Markdown blockquote with source link
    const clipMarkdown = pageUrl && !pageUrl.startsWith("chrome://")
      ? `\n\n> ${info.selectionText.trim()}\n— Source: [${pageTitle}](${pageUrl})`
      : `\n\n> ${info.selectionText.trim()}`;

    // Read current note and append the snippet
    chrome.storage.sync.get(["quickNote"], (result) => {
      const existingNote = result.quickNote || "";
      const updatedNote = existingNote ? `${existingNote}${clipMarkdown}` : clipMarkdown.trimStart();

      chrome.storage.sync.set({ quickNote: updatedNote });
    });
  }
});
