#!/usr/bin/env node

import { resolve } from "node:path";
import { processVideo, syncObsidianVault, DEFAULT_OUTPUT_DIR } from "./core.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: yt2obsidian <youtube-url> [options]

Options:
  --lang <code>    Language code for transcript (default: ja, fallback: en)
  --out <dir>      Output directory (default: ~/workspace/obsidian/Clippings)
  --no-summary     Skip AI summary generation
  --no-sync        Skip Obsidian vault git sync
  --help, -h       Show this help message

Environment:
  ANTHROPIC_API_KEY  Required for AI summary (Claude Haiku)

Examples:
  yt2obsidian https://www.youtube.com/watch?v=xxxxx
  yt2obsidian https://youtu.be/xxxxx --lang en
  yt2obsidian https://youtu.be/xxxxx --no-summary
  yt2obsidian https://youtu.be/xxxxx --out ./output`);
    process.exit(0);
  }

  let url = "";
  let lang = "ja";
  let skipSummary = false;
  let skipSync = false;
  let outputDir = DEFAULT_OUTPUT_DIR;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lang" && args[i + 1]) {
      lang = args[i + 1];
      i++;
    } else if (args[i] === "--out" && args[i + 1]) {
      outputDir = resolve(args[i + 1]);
      i++;
    } else if (args[i] === "--no-summary") {
      skipSummary = true;
    } else if (args[i] === "--no-sync") {
      skipSync = true;
    } else if (!args[i].startsWith("--")) {
      url = args[i];
    }
  }

  if (!url) {
    console.error("Error: YouTube URL is required");
    process.exit(1);
  }

  const result = await processVideo({
    url,
    lang,
    skipSummary,
    outputDir,
    onProgress: console.log,
  });

  console.log(`\nDone: ${result.outputPath}`);

  if (!skipSync) {
    syncObsidianVault(console.log);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
