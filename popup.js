const noteArea = document.getElementById("noteArea");
const previewArea = document.getElementById("previewArea");
const toggleMarkdownBtn = document.getElementById("toggleMarkdownBtn");
const timestampBtn = document.getElementById("timestampBtn");
const exportBtn = document.getElementById("exportBtn");
const themeSelect = document.getElementById("themeSelect");
const fontSelect = document.getElementById("fontSelect");
const fontSizeSelect = document.getElementById("fontSizeSelect");
const statusEl = document.getElementById("status");
const charCount = document.getElementById("charCount");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");

let isPreviewMode = false;
let debounceTimer;

const FONT_MAP = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  roboto: '"Roboto", sans-serif',
  merriweather: '"Merriweather", Georgia, serif',
  nunito: '"Nunito", sans-serif',
  mono: '"JetBrains Mono", monospace'
};

// Markdown parser with highlights and tasks
function parseMarkdown(md) {
  let taskIndex = 0;

  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    // Blockquote
    .replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>")
    // Priority Highlights (High: ==text==, Med: ~text~, Low: +text+, Info: *text*)
    .replace(/==(.*?)==/gim, '<span class="hl-high">$1</span>')
    .replace(/~(.*?)~/gim, '<span class="hl-med">$1</span>')
    .replace(/\+(.*?)\+/gim, '<span class="hl-low">$1</span>')
    .replace(/\*(.*?)\*/gim, '<span class="hl-info">$1</span>')
    // Interactive Task Checkboxes: - [ ] and - [x]
    .replace(/^\s*[\-\*]\s+\[ \]\s+(.*)$/gim, (_, content) => {
      const idx = taskIndex++;
      return `<li class="task-item"><input type="checkbox" class="task-checkbox" data-task-index="${idx}"><span>${content}</span></li>`;
    })
    .replace(/^\s*[\-\*]\s+\[[xX]\]\s+(.*)$/gim, (_, content) => {
      const idx = taskIndex++;
      return `<li class="task-item completed"><input type="checkbox" class="task-checkbox" data-task-index="${idx}" checked><span>${content}</span></li>`;
    })
    // Standard unordered lists
    .replace(/^\s*[\-\*]\s+(.*)$/gim, "<li>$1</li>")
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    // Inline code
    .replace(/`(.*?)`/gim, "<code>$1</code>")
    // Links [text](url)
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>')
    // Linebreaks
    .replace(/\n$/gim, "<br />");

  html = html.replace(/(<li[\s\S]*?<\/li>)/gis, "<ul>$1</ul>");
  html = html.replace(/\n/g, "<br />");

  return html;
}

// Wrapper for highlighter buttons
function wrapHighlight(tagType) {
  if (isPreviewMode) return;

  const tagMap = {
    high: { open: "==", close: "==" },
    med: { open: "~", close: "~" },
    low: { open: "+", close: "+" },
    info: { open: "*", close: "*" }
  };

  const tag = tagMap[tagType] || tagMap.high;
  const start = noteArea.selectionStart;
  const end = noteArea.selectionEnd;
  const original = noteArea.value;
  const selectedText = original.substring(start, end) || "Important Note";

  const wrapped = `${tag.open}${selectedText}${tag.close}`;
  noteArea.value = original.substring(0, start) + wrapped + original.substring(end);

  const newPos = start + wrapped.length;
  noteArea.setSelectionRange(newPos, newPos);
  noteArea.focus();

  updateCount();
  saveNote();
}

function toggleTaskState(taskIndex, isChecked) {
  let currentIdx = 0;
  const taskRegex = /^(\s*[\-\*]\s+\[)([ xX])(\]\s+.*)$/gm;

  noteArea.value = noteArea.value.replace(taskRegex, (match, prefix, checkState, suffix) => {
    if (currentIdx === taskIndex) {
      currentIdx++;
      return `${prefix}${isChecked ? "x" : " "}${suffix}`;
    }
    currentIdx++;
    return match;
  });

  updateCount();
  saveNote();
}

function updateCount() {
  const len = noteArea.value.length;
  charCount.textContent = `${len} character${len === 1 ? "" : "s"}`;
}

function showStatus(text, duration = 1200) {
  statusEl.textContent = text;
  statusEl.style.opacity = "1";
  if (duration > 0) {
    setTimeout(() => {
      statusEl.textContent = "Saved";
    }, duration);
  }
}

function applyFont(fontKey) {
  const fontFamily = FONT_MAP[fontKey] || FONT_MAP.system;
  document.documentElement.style.setProperty("--active-font", fontFamily);
  fontSelect.value = fontKey;
}

function applyFontSize(sizeValue) {
  document.documentElement.style.setProperty("--active-font-size", sizeValue);
  fontSizeSelect.value = sizeValue;
}

function renderPreview() {
  previewArea.innerHTML = parseMarkdown(noteArea.value) || "<em>No content to preview</em>";
}

function insertTimestamp() {
  if (isPreviewMode) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const timestamp = `\n\n### ${year}-${month}-${day} ${hours}:${minutes}\n`;

  const startPos = noteArea.selectionStart;
  const endPos = noteArea.selectionEnd;
  const originalText = noteArea.value;

  noteArea.value = originalText.substring(0, startPos) + timestamp + originalText.substring(endPos);
  
  const newPos = startPos + timestamp.length;
  noteArea.setSelectionRange(newPos, newPos);
  noteArea.focus();

  updateCount();
  saveNote();
  showStatus("Timestamp added");
}

function saveNote() {
  statusEl.textContent = "Saving...";
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    chrome.storage.sync.set({ quickNote: noteArea.value }, () => {
      showStatus("Saved", 0);
    });
  }, 300);
}

function exportMarkdown() {
  if (!noteArea.value.trim()) {
    showStatus("Note is empty");
    return;
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const filename = `quick-notes-${dateStr}.md`;

  const blob = new Blob([noteArea.value], { type: "text/markdown;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(downloadUrl);
  showStatus("Exported .md");
}

// Load initial state
chrome.storage.sync.get(["quickNote", "quickNoteTheme", "quickNoteFont", "quickNoteFontSize"], (result) => {
  if (result.quickNote) {
    noteArea.value = result.quickNote;
  }
  if (result.quickNoteTheme) {
    document.body.setAttribute("data-theme", result.quickNoteTheme);
    themeSelect.value = result.quickNoteTheme;
  }
  if (result.quickNoteFont) {
    applyFont(result.quickNoteFont);
  }
  if (result.quickNoteFontSize) {
    applyFontSize(result.quickNoteFontSize);
  }
  updateCount();
  noteArea.focus();
});

// Sync background clippings
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync" && changes.quickNote) {
    noteArea.value = changes.quickNote.newValue || "";
    if (isPreviewMode) {
      renderPreview();
    }
    updateCount();
    showStatus("Clipped & Saved");
  }
});

// Event Delegation for Highlighter Buttons
document.querySelectorAll(".color-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    wrapHighlight(btn.getAttribute("data-tag"));
  });
});

// Handle checkbox clicks inside preview area
previewArea.addEventListener("change", (e) => {
  if (e.target.classList.contains("task-checkbox")) {
    const taskIndex = parseInt(e.target.getAttribute("data-task-index"), 10);
    const isChecked = e.target.checked;
    
    const parentLi = e.target.closest("li");
    if (parentLi) {
      parentLi.classList.toggle("completed", isChecked);
    }
    
    toggleTaskState(taskIndex, isChecked);
  }
});

// Hotkey listener
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
    e.preventDefault();
    insertTimestamp();
  }
});

fontSelect.addEventListener("change", (e) => {
  const fontKey = e.target.value;
  applyFont(fontKey);
  chrome.storage.sync.set({ quickNoteFont: fontKey });
});

fontSizeSelect.addEventListener("change", (e) => {
  const sizeValue = e.target.value;
  applyFontSize(sizeValue);
  chrome.storage.sync.set({ quickNoteFontSize: sizeValue });
});

themeSelect.addEventListener("change", (e) => {
  const theme = e.target.value;
  document.body.setAttribute("data-theme", theme);
  chrome.storage.sync.set({ quickNoteTheme: theme });
});

timestampBtn.addEventListener("click", insertTimestamp);
exportBtn.addEventListener("click", exportMarkdown);

noteArea.addEventListener("input", () => {
  updateCount();
  saveNote();
});

toggleMarkdownBtn.addEventListener("click", () => {
  isPreviewMode = !isPreviewMode;

  if (isPreviewMode) {
    renderPreview();
    noteArea.style.display = "none";
    previewArea.style.display = "block";
    toggleMarkdownBtn.textContent = "✏️ Edit Note";
    toggleMarkdownBtn.classList.add("active");
  } else {
    previewArea.style.display = "none";
    noteArea.style.display = "block";
    toggleMarkdownBtn.textContent = "👁️ Preview";
    toggleMarkdownBtn.classList.remove("active");
    noteArea.focus();
  }
});

copyBtn.addEventListener("click", async () => {
  if (!noteArea.value) return;
  try {
    await navigator.clipboard.writeText(noteArea.value);
    showStatus("Copied!");
  } catch {
    showStatus("Copy failed");
  }
});

clearBtn.addEventListener("click", () => {
  if (noteArea.value && confirm("Clear your note?")) {
    noteArea.value = "";
    previewArea.innerHTML = "";
    chrome.storage.sync.set({ quickNote: "" }, () => {
      updateCount();
      showStatus("Cleared");
    });
  }
});