import { createServer } from "node:http";
import { processVideo, syncObsidianVault, DEFAULT_OUTPUT_DIR } from "./core.js";

const PORT = parseInt(process.env.PORT || "3456", 10);

// ---------------------------------------------------------------------------
// HTML form (mobile-friendly)
// ---------------------------------------------------------------------------

const HTML_FORM = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>YT2Obsidian</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 16px;
    background: #0f0f0f;
    color: #e0e0e0;
    padding: 20px;
    min-height: 100dvh;
  }
  h1 { font-size: 1.4rem; margin-bottom: 20px; color: #fff; }
  form { display: flex; flex-direction: column; gap: 14px; max-width: 600px; }
  label { font-size: 0.9rem; color: #aaa; }
  input[type="text"], select {
    font-size: 16px;
    padding: 12px;
    border: 1px solid #333;
    border-radius: 8px;
    background: #1a1a1a;
    color: #fff;
    width: 100%;
  }
  .row { display: flex; gap: 10px; align-items: center; }
  .row label { white-space: nowrap; }
  button {
    font-size: 1.1rem;
    padding: 14px;
    border: none;
    border-radius: 8px;
    background: #c00;
    color: #fff;
    cursor: pointer;
    font-weight: 600;
  }
  button:disabled { opacity: 0.5; cursor: wait; }
  #result {
    margin-top: 20px;
    padding: 16px;
    border-radius: 8px;
    display: none;
    word-break: break-all;
    white-space: pre-wrap;
    font-size: 0.9rem;
  }
  #result.ok { background: #1a3a1a; border: 1px solid #2a5a2a; display: block; }
  #result.err { background: #3a1a1a; border: 1px solid #5a2a2a; display: block; }
  .check { display: flex; align-items: center; gap: 8px; }
  .check input { width: 20px; height: 20px; }
</style>
</head>
<body>
<h1>YT2Obsidian</h1>
<form id="f">
  <div>
    <label for="url">YouTube URL</label>
    <input type="text" id="url" name="url" placeholder="https://youtu.be/..." required>
  </div>
  <div class="row">
    <label for="lang">Lang</label>
    <select id="lang" name="lang">
      <option value="ja" selected>ja</option>
      <option value="en">en</option>
    </select>
  </div>
  <div class="check">
    <input type="checkbox" id="skip" name="skipSummary">
    <label for="skip">Skip AI summary</label>
  </div>
  <button type="submit" id="btn">Save Transcript</button>
</form>
<div id="result"></div>
<details style="margin-top:24px">
  <summary style="color:#888;cursor:pointer;font-size:0.85rem">Bookmarklet</summary>
  <p style="color:#777;font-size:0.8rem;margin:8px 0">
    Drag to bookmarks bar. Click on any YouTube page to save transcript:
  </p>
  <a id="bookmarklet" href="#" style="display:inline-block;padding:8px 16px;background:#333;color:#fff;border-radius:6px;text-decoration:none;font-size:0.85rem">YT2Obsidian</a>
</details>
<script>
const f = document.getElementById("f");
const btn = document.getElementById("btn");
const res = document.getElementById("result");
const urlInput = document.getElementById("url");
// Auto-fill from ?url= query param (bookmarklet redirect)
const params = new URLSearchParams(location.search);
if (params.get("url")) {
  urlInput.value = params.get("url");
  f.dispatchEvent(new Event("submit"));
}
// Generate bookmarklet with current host
const bm = document.getElementById("bookmarklet");
const origin = location.origin;
bm.href = "javascript:void(location.href='" + origin + "/?url='+encodeURIComponent(location.href))";
f.addEventListener("submit", async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = "Processing...";
  res.className = "";
  res.style.display = "none";
  try {
    const r = await fetch("/api/transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: urlInput.value,
        lang: document.getElementById("lang").value,
        skipSummary: document.getElementById("skip").checked,
      }),
    });
    const data = await r.json();
    if (r.ok) {
      res.className = "ok";
      res.textContent = "Saved: " + data.filename + "\\nTitle: " + data.title + "\\nChannel: " + data.channelName + "\\nLanguage: " + data.language + "\\nSummary: " + (data.hasSummary ? "Yes" : "Skipped");
    } else {
      res.className = "err";
      res.textContent = "Error: " + (data.error || r.statusText);
    }
  } catch (err) {
    res.className = "err";
    res.textContent = "Network error: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Transcript";
  }
});
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  // CORS headers for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  console.log(`[req] ${req.method} ${req.url} from ${req.headers["user-agent"]?.slice(0, 50)}`);

  // GET / → Web form
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML_FORM);
    return;
  }

  // GET /health
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // GET /debug — echo everything the client sends
  if (req.method === "GET" && url.pathname === "/debug") {
    const echo = {
      method: req.method,
      url: req.url,
      params: Object.fromEntries(url.searchParams),
      headers: req.headers,
    };
    console.log(`[debug]`, JSON.stringify(echo, null, 2));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(echo, null, 2));
    return;
  }


  // GET|POST /api/transcript
  if (url.pathname === "/api/transcript" && (req.method === "GET" || req.method === "POST")) {
    let payload: { url?: string; lang?: string; skipSummary?: boolean };

    if (req.method === "GET") {
      payload = {
        url: url.searchParams.get("url") || undefined,
        lang: url.searchParams.get("lang") || undefined,
        skipSummary: url.searchParams.get("skipSummary") === "true",
      };
    } else {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }
    }

    if (!payload.url) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "url is required" }));
      return;
    }

    try {
      const logs: string[] = [];
      const result = await processVideo({
        url: payload.url,
        lang: payload.lang,
        skipSummary: payload.skipSummary,
        outputDir: DEFAULT_OUTPUT_DIR,
        onProgress: (msg) => {
          logs.push(msg);
          console.log(`[transcript] ${msg}`);
        },
      });

      // Sync Obsidian vault after saving
      syncObsidianVault((msg) => console.log(`[sync] ${msg}`));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[transcript] Error: ${msg}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: msg }));
    }
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`yt2obsidian server listening on http://0.0.0.0:${PORT}`);
  console.log(`Output dir: ${DEFAULT_OUTPUT_DIR}`);
});
