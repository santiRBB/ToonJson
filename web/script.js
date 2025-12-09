/* --- SAMPLE EXAMPLES --- */

// JSON examples to cycle through in the left panel
const JSON_SAMPLES = [
  // 1) Simple top level array
  `[
  { "id": 1, "name": "Alice", "role": "admin" },
  { "id": 2, "name": "Bob", "role": "user" },
  { "id": 3, "name": "Carol", "role": "user" }
]`,

  // 2) Object with two labeled tables
  `{
  "users": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" }
  ],
  "roles": [
    { "role_id": 1, "role": "manager" },
    { "role_id": 2, "role": "user" }
  ]
}`,

  // 3) Strings with commas and quotes
  `{
  "products": [
    { "id": 1, "name": "Basic T-Shirt", "price": 9.99 },
    { "id": 2, "name": "Premium Hoodie, Blue", "price": 39.5 },
    { "id": 3, "name": "Mug \\"Best Dev\\"", "price": 12 }
  ]
}`,

  // 4) Nested tabular arrays
  `{
  "team": "Core API",
  "members": [
    { "id": 1, "name": "Alice", "role": "lead" },
    { "id": 2, "name": "Bob", "role": "dev" },
    { "id": 3, "name": "Carol", "role": "dev" }
  ],
  "sprints": [
    { "id": 10, "name": "Sprint 1", "done": true },
    { "id": 11, "name": "Sprint 2", "done": false }
  ]
}`,

  // 5) Non-tabular arrays and primitives
  `{
  "mixed": [
    { "id": 1, "name": "ok" },
    { "id": 2, "extra": "different shape" }
  ],
  "primitives": [1, 2, 3, true, "hello"]
}`,

  // 6) Config + logs (good to test modes)
  `{
  "config": {
    "name": "My LLM App",
    "max_tokens": 2048,
    "temperature": 0.2,
    "enabled": true
  },
  "logs": [
    { "id": 1, "status": "ok" },
    { "id": 2, "status": "error" }
  ]
}`,
];

// TOON examples to cycle through in the right panel
// Note: reverse parsing currently only understands the tabular syntax
const TOON_SAMPLES = [
  // 1) Simple top level table
  `items[3]{id,name,role}:
  1,Alice,admin
  2,Bob,user
  3,Carol,user`,

  // 2) Two labeled tables
  `users[2]{id,name}:
  1,Alice
  2,Bob
roles[2]{role_id,role}:
  1,manager
  2,user`,

  // 3) Strings with commas and quotes
  `products[3]{id,name,price}:
  1,Basic T-Shirt,9.99
  2,"Premium Hoodie, Blue",39.5
  3,"Mug \\"Best Dev\\"",12`,
];

let currentJsonSampleIndex = 0;
let currentToonSampleIndex = 0;

/* --- CORE LOGIC --- */

function jsonToToon(jsonInput, mode = "auto") {
  const obj = typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
  const effectiveMode = mode || "auto";

  function isTabularArray(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }

    const first = data[0];
    if (!first || typeof first !== "object" || Array.isArray(first)) {
      return false;
    }

    const keys = Object.keys(first);
    if (keys.length === 0) {
      return false;
    }

    return data.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return false;
      }
      const itemKeys = Object.keys(item);
      if (itemKeys.length !== keys.length) {
        return false;
      }
      return keys.every((k) => Object.prototype.hasOwnProperty.call(item, k));
    });
  }

  function renderTabularArray(data, indent, headerLabel) {
    const space = " ".repeat(indent);
    const keys = Object.keys(data[0]);

    let output = `${space}${headerLabel}[${data.length}]{${keys.join(",")}}:\n`;

    output += data
      .map((item) => {
        const row = keys
          .map((k) => {
            let val = item[k];

            if (typeof val === "string") {
              let safeVal = val.replace(/"/g, '\\"');

              if (effectiveMode === "strict") {
                return `"${safeVal}"`;
              }

              if (safeVal.includes(",")) {
                return `"${safeVal}"`;
              }
              return safeVal;
            }

            if (effectiveMode === "strict") {
              return JSON.stringify(val);
            }

            return val;
          })
          .join(",");
        return `${space}  ${row}`;
      })
      .join("\n");

    return output;
  }

  function formatPrimitive(value) {
    if (value === null || value === undefined) {
      return "null";
    }

    if (typeof value === "string") {
      if (effectiveMode === "strict") {
        return JSON.stringify(value);
      }
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    // Fallback for unexpected types
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }

  function stringify(data, indent = 0) {
    const space = " ".repeat(indent);
    const allowTabular = effectiveMode !== "jsonlike";

    // Top level or root arrays
    if (allowTabular && isTabularArray(data)) {
      const headerLabel = "items";
      return renderTabularArray(data, indent, headerLabel);
    }

    if (Array.isArray(data)) {
      return data
        .map((item) => `${space}- ${stringify(item, indent + 2).trim()}`)
        .join("\n");
    }

    if (data && typeof data === "object") {
      return Object.entries(data)
        .map(([key, value]) => {
          // Nested tabular arrays get their key name as header
          if (allowTabular && isTabularArray(value)) {
            return renderTabularArray(value, indent, key);
          }

          if (Array.isArray(value)) {
            return `${space}${key}:\n${stringify(value, indent + 2)}`;
          }

          if (value && typeof value === "object") {
            return `${space}${key}:\n${stringify(value, indent + 2)}`;
          }

          return `${space}${key}: ${formatPrimitive(value)}`;
        })
        .join("\n");
    }

    return formatPrimitive(data);
  }

  return stringify(obj);
}

function toonToJson(toonStr) {
  const lines = toonStr.trim().split(/\r?\n/);

  let currentKeys = null;
  let currentArray = null;
  let currentLabel = null;

  const rootObject = {};
  let rootArray = null;
  let hasLabeledTables = false;

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // Detect header: label[3]{id,name,role}:
    // Capture label and key list
    const headerMatch = trimmed.match(/^(.+?)\[\d+\]\{([^}]*)\}:/);

    if (headerMatch) {
      currentLabel = headerMatch[1].trim();
      const keysStr = headerMatch[2];

      currentKeys = keysStr.split(",").map((k) => k.trim());
      currentArray = [];

      if (currentLabel && currentLabel !== "items") {
        // Labeled tables -> build an object { users: [...], roles: [...] }
        rootObject[currentLabel] = currentArray;
        hasLabeledTables = true;
      } else {
        // "items" -> treat as a plain root array for backward compatibility
        rootArray = currentArray;
      }
      continue;
    }

    // If we have no active header/keys, ignore the line
    if (!currentKeys || !currentArray) {
      continue;
    }

    // Split by comma ONLY if outside quotes
    const rawValues = trimmed.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

    const obj = {};
    currentKeys.forEach((key, index) => {
      let val = rawValues[index] ? rawValues[index].trim() : "";

      // Remove surrounding quotes and unescape
      if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/\\"/g, '"');
        obj[key] = val;
      } else if (val === "true") {
        obj[key] = true;
      } else if (val === "false") {
        obj[key] = false;
      } else if (val !== "" && !isNaN(val)) {
        obj[key] = Number(val);
      } else {
        obj[key] = val;
      }
    });

    currentArray.push(obj);
  }

  if (hasLabeledTables) {
    return rootObject;
  }

  if (rootArray && rootArray.length > 0) {
    return rootArray;
  }

  return [];
}

/* --- GLUE CODE --- */

function convert() {
  const inputStr = document.getElementById("jsonInput").value;
  const outputBox = document.getElementById("toonOutput");
  const modeSelect = document.getElementById("modeSelect");
  const mode = modeSelect ? modeSelect.value : "auto";

  try {
    if (!inputStr.trim()) {
      return;
    }

    const toonResult = jsonToToon(inputStr, mode);
    outputBox.value = toonResult;

    // Update metrics and savings badge
    updateStats();
  } catch (e) {
    outputBox.value = "Error: Invalid JSON.\n" + e.message;
    updateStats();
  }
}

function reverseConvert() {
  const inputStr = document.getElementById("toonOutput").value;
  const outputBox = document.getElementById("jsonInput");

  try {
    if (!inputStr.trim()) {
      alert("Please paste some TOON syntax in the right panel first.");
      return;
    }

    const jsonObj = toonToJson(inputStr);
    outputBox.value = JSON.stringify(jsonObj, null, 2);

    updateStats();
  } catch (e) {
    outputBox.value = "Error: Invalid TOON table.\n" + e.message;
    updateStats();
  }
}

/* --- CLIPBOARD & SAMPLES --- */

async function copyJsonToClipboard() {
  const jsonText = document.getElementById("jsonInput").value;
  try {
    await navigator.clipboard.writeText(jsonText);
    const msg = document.getElementById("copyJsonMsg");
    if (msg) {
      msg.style.display = "inline";
      setTimeout(() => {
        msg.style.display = "none";
      }, 2000);
    }
  } catch (err) {
    console.error("Failed to copy", err);
  }
}

async function copyToonToClipboard() {
  const toonText = document.getElementById("toonOutput").value;
  try {
    await navigator.clipboard.writeText(toonText);
    const msg = document.getElementById("copyMsg");
    if (msg) {
      msg.style.display = "inline";
      setTimeout(() => {
        msg.style.display = "none";
      }, 2000);
    }
  } catch (err) {
    console.error("Failed to copy", err);
  }
}

// Cycle through JSON examples on each click
function pasteJsonSample() {
  const textarea = document.getElementById("jsonInput");
  if (!textarea || JSON_SAMPLES.length === 0) {
    return;
  }

  textarea.value = JSON_SAMPLES[currentJsonSampleIndex];
  currentJsonSampleIndex = (currentJsonSampleIndex + 1) % JSON_SAMPLES.length;

  updateStats();
}

// Cycle through TOON examples on each click
function pasteToonSample() {
  const textarea = document.getElementById("toonOutput");
  if (!textarea || TOON_SAMPLES.length === 0) {
    return;
  }

  textarea.value = TOON_SAMPLES[currentToonSampleIndex];
  currentToonSampleIndex = (currentToonSampleIndex + 1) % TOON_SAMPLES.length;

  updateStats();
}

/* --- METRICS LOGIC --- */

function updateStats() {
  const jsonText = document.getElementById("jsonInput").value;
  const toonText = document.getElementById("toonOutput").value;

  calculatePanelStats(jsonText, "json");
  calculatePanelStats(toonText, "toon");

  // This calculates the savings for BOTH Convert and Reverse
  updateSavingsBadge(jsonText.length, toonText.length);
}

function calculatePanelStats(text, prefix) {
  const charCount = text.length;
  const tokenCount = Math.ceil(charCount / 4);
  const lineCount = text.length > 0 ? text.split(/\r\n|\r|\n/).length : 0;

  const charsEl = document.getElementById(`${prefix}Chars`);
  const tokensEl = document.getElementById(`${prefix}Tokens`);
  const linesEl = document.getElementById(`${prefix}Lines`);

  if (!charsEl || !tokensEl || !linesEl) {
    return;
  }

  charsEl.innerText = `${formatNumber(charCount)} chars`;
  tokensEl.innerText = `≈ ${formatNumber(tokenCount)} tokens`;
  linesEl.innerText = `${formatNumber(lineCount)} lines`;
}

function updateSavingsBadge(jsonLen, toonLen) {
  const badge = document.getElementById("savingsBadge");

  if (!badge) {
    return;
  }

  if (jsonLen === 0 || toonLen === 0) {
    badge.style.display = "none";
    return;
  }

  // Savings Logic: (Big - Small) / Big
  const savedPercent = ((jsonLen - toonLen) / jsonLen) * 100;

  badge.style.display = "inline-block";
  badge.innerText = `${Math.round(savedPercent)}% Saved`;

  if (savedPercent > 0) {
    badge.style.color = "var(--success-color)";
    badge.style.backgroundColor = "rgba(34, 197, 94, 0.1)";
  } else {
    badge.style.color = "#ef4444";
    badge.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
  }
}

function formatNumber(num) {
  return new Intl.NumberFormat().format(num);
}
