#!/usr/bin/env node

// Import from dist/api directly to avoid CLI auto-execution from the package's index
// @ts-expect-error — no types for subpath import
import _api from "@playzone/youtube-transcript/dist/api/index.js";
const YouTubeTranscriptApi = _api.default || _api;
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env — look next to package.json (walk up from cwd or script dir)
function findEnv(): string | null {
  for (const base of [process.cwd(), new URL(".", import.meta.url).pathname]) {
    let dir = resolve(base);
    for (let i = 0; i < 5; i++) {
      const candidate = resolve(dir, ".env");
      if (existsSync(resolve(dir, "package.json")) && existsSync(candidate)) {
        return candidate;
      }
      dir = resolve(dir, "..");
    }
  }
  return null;
}
const envPath = findEnv();
if (envPath) {
  for (const raw of readFileSync(envPath, "utf-8").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const DEFAULT_OUTPUT_DIR = resolve(
  process.env.HOME || "/home/hal",
  "workspace/obsidian/Clippings"
);

interface VideoMeta {
  title: string;
  channelName: string;
  description: string;
  publishedDate: string;
}

function extractVideoId(input: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  throw new Error(`Invalid YouTube URL or video ID: ${input}`);
}

async function fetchVideoMeta(videoId: string): Promise<VideoMeta> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "ja,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch YouTube page: ${res.status}`);
  }

  const html = await res.text();

  // Title from <title> tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  let title = titleMatch
    ? titleMatch[1].replace(/ - YouTube$/, "").trim()
    : "Untitled";
  title = decodeHtmlEntities(title);

  // Channel name from ytInitialData JSON
  let channelName = "Unknown";
  const channelMatch = html.match(/"ownerChannelName"\s*:\s*"([^"]+)"/);
  if (channelMatch) {
    channelName = decodeUnicodeEscapes(channelMatch[1]);
  } else {
    const linkMatch = html.match(
      /<link itemprop="name" content="([^"]+)">/
    );
    if (linkMatch) {
      channelName = decodeHtmlEntities(linkMatch[1]);
    }
  }

  // Description from og:description
  let description = "";
  const descMatch = html.match(
    /<meta property="og:description" content="([^"]*)">/
  );
  if (descMatch) {
    description = decodeHtmlEntities(descMatch[1]);
  }

  // Publish date
  let publishedDate = "";
  const dateMatch = html.match(
    /"(?:datePublished|uploadDate)"\s*:\s*"(\d{4}-\d{2}-\d{2})/
  );
  if (dateMatch) {
    publishedDate = dateMatch[1];
  }

  return { title, channelName, description, publishedDate };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10))
    );
}

function decodeUnicodeEscapes(text: string): string {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
    String.fromCodePoint(parseInt(hex, 16))
  );
}

function formatTimestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

async function generateSummary(
  title: string,
  transcriptText: string
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  // Truncate to ~12000 chars for Haiku's context
  const truncated =
    transcriptText.length > 12000
      ? transcriptText.slice(0, 12000) + "\n...(truncated)"
      : transcriptText;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `以下はYouTube動画「${title}」のトランスクリプトです。この内容を日本語で要約してください。

要件:
- 動画の主要なポイントを箇条書き（3〜7個）でまとめる
- 各ポイントは1〜2文で簡潔に
- 専門用語はそのまま残す
- Markdown記法で出力（見出し不要、箇条書きのみ）

トランスクリプト:
${truncated}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Empty response from Anthropic API");
  return text.trim();
}

function sanitizeFilename(name: string): string {
  return name
    // OS forbidden: < > : " / \ | ? *
    // Obsidian special: # ^ [ ] | (wikilink/block-ref syntax)
    .replace(/[<>:"/\\|?*#^[\]]/g, "")
    // Control characters
    .replace(/[\x00-\x1f\x7f]/g, "")
    // Leading/trailing dots (hidden files, Windows issues)
    .replace(/^\.+|\.+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function escapeYamlString(s: string): string {
  if (/[:"'#\[\]{}|>&*!%@`]/.test(s) || s.includes("\n")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return `"${s}"`;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: yt-transcript <youtube-url> [options]

Options:
  --lang <code>    Language code for transcript (default: ja, fallback: en)
  --out <dir>      Output directory (default: ~/workspace/obsidian/Clippings)
  --no-summary     Skip AI summary generation
  --help, -h       Show this help message

Environment:
  ANTHROPIC_API_KEY  Required for AI summary (Claude Haiku)

Examples:
  yt-transcript https://www.youtube.com/watch?v=xxxxx
  yt-transcript https://youtu.be/xxxxx --lang en
  yt-transcript https://youtu.be/xxxxx --no-summary
  yt-transcript https://youtu.be/xxxxx --out ./output`);
    process.exit(0);
  }

  let url = "";
  let preferredLang = "ja";
  let skipSummary = false;
  let outputDir = DEFAULT_OUTPUT_DIR;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lang" && args[i + 1]) {
      preferredLang = args[i + 1];
      i++;
    } else if (args[i] === "--out" && args[i + 1]) {
      outputDir = resolve(args[i + 1]);
      i++;
    } else if (args[i] === "--no-summary") {
      skipSummary = true;
    } else if (!args[i].startsWith("--")) {
      url = args[i];
    }
  }

  if (!url) {
    console.error("Error: YouTube URL is required");
    process.exit(1);
  }

  const videoId = extractVideoId(url);
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

  console.log(`Fetching video metadata for ${videoId}...`);
  const meta = await fetchVideoMeta(videoId);
  console.log(`Title: ${meta.title}`);
  console.log(`Channel: ${meta.channelName}`);

  // Fetch transcript with language fallback
  const api = new YouTubeTranscriptApi();
  const langPriority =
    preferredLang === "ja"
      ? ["ja", "en"]
      : [preferredLang, "ja", "en"];
  // Deduplicate
  const langs = [...new Set(langPriority)];

  console.log(`Fetching transcript (preferred: ${preferredLang})...`);

  let transcript;
  for (const lang of langs) {
    try {
      transcript = await api.fetch(videoId, [lang]);
      console.log(
        `Transcript found (lang: ${transcript.languageCode}, ${transcript.language})`
      );
      break;
    } catch {
      console.log(`No transcript for lang: ${lang}, trying next...`);
    }
  }

  // Last resort: fetch any available
  if (!transcript) {
    try {
      transcript = await api.fetch(videoId);
      console.log(
        `Transcript found (lang: ${transcript.languageCode}, ${transcript.language})`
      );
    } catch {
      console.error(
        "Error: No transcript available for this video."
      );
      process.exit(1);
    }
  }

  // Format transcript lines
  const transcriptLines = transcript.snippets.map(
    (s: { text: string; start: number }) =>
      `[${formatTimestamp(s.start)}] ${s.text}`
  );
  const transcriptText = transcriptLines.join("\n");

  // Build markdown
  const today = new Date().toISOString().split("T")[0];
  const descShort =
    meta.description.length > 200
      ? meta.description.slice(0, 200) + "..."
      : meta.description;

  const frontmatter = [
    "---",
    `title: ${escapeYamlString(meta.title)}`,
    `source: ${escapeYamlString(canonicalUrl)}`,
    "author:",
    `  - "[[${meta.channelName}]]"`,
    meta.publishedDate ? `published: ${meta.publishedDate}` : null,
    `created: ${today}`,
    `description: ${escapeYamlString(descShort)}`,
    "tags:",
    '  - "clippings"',
    '  - "youtube-transcript"',
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  // Generate summary with Ollama
  let summarySection = "";
  if (!skipSummary) {
    console.log(`Generating summary with ${HAIKU_MODEL}...`);
    try {
      const summary = await generateSummary(meta.title, transcriptText);
      summarySection = `\n## Summary\n\n${summary}\n`;
      console.log("Summary generated.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`Warning: Summary generation failed (${msg}). Skipping.`);
    }
  }

  const markdown = `${frontmatter}\n${summarySection}\n## Transcript\n\n${transcriptText}\n`;

  const filename = `${sanitizeFilename(meta.title)}.md`;
  const outputPath = resolve(outputDir, filename);

  writeFileSync(outputPath, markdown, "utf-8");
  console.log(`\nSaved: ${outputPath}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
