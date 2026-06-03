import { describe, it, expect, vi, afterEach } from "vitest";
import {
  extractVideoId,
  formatTranscriptWithOllama,
  formatTranscriptMechanical,
  formatTranscriptForOutput,
  type TranscriptSnippet,
} from "./core.js";

describe("extractVideoId", () => {
  const VIDEO_ID = "dQw4w9WgXcQ";

  it("extracts ID from standard watch URL", () => {
    expect(extractVideoId(`https://www.youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it("extracts ID from youtu.be short URL", () => {
    expect(extractVideoId(`https://youtu.be/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it("extracts ID from embed URL", () => {
    expect(extractVideoId(`https://www.youtube.com/embed/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it("extracts ID from shorts URL", () => {
    expect(extractVideoId(`https://www.youtube.com/shorts/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it("extracts ID from YouTube Live URL", () => {
    expect(extractVideoId(`https://www.youtube.com/live/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it("extracts ID from YouTube Live URL with query params", () => {
    expect(extractVideoId(`https://www.youtube.com/live/${VIDEO_ID}?si=abc123`)).toBe(VIDEO_ID);
  });

  it("returns bare video ID as-is", () => {
    expect(extractVideoId(VIDEO_ID)).toBe(VIDEO_ID);
  });

  it("throws on invalid URL", () => {
    expect(() => extractVideoId("https://example.com/video")).toThrow("無効なYouTube URLです");
  });
});

// ---------------------------------------------------------------------------
// Transcript formatting tests
// ---------------------------------------------------------------------------

const SAMPLE_SNIPPETS: TranscriptSnippet[] = [
  { text: "今日はプログラミングについて話します", start: 0 },
  { text: "特にTypeScriptの型システムが重要です。", start: 5 },
  { text: "型安全性はバグを減らします", start: 10 },
  { text: "また開発効率も上がります。", start: 15 },
  { text: "ぜひ試してみてください！", start: 20 },
];

describe("formatTranscriptMechanical", () => {
  it("groups sentences into paragraphs by punctuation", () => {
    const result = formatTranscriptMechanical(SAMPLE_SNIPPETS);
    expect(result).toContain("TypeScript");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty string for single snippet", () => {
    const result = formatTranscriptMechanical([{ text: "Hello.", start: 0 }]);
    expect(result).toBe("Hello.");
  });
});

describe("formatTranscriptWithOllama", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when fetch throws (fallback path)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const result = await formatTranscriptWithOllama("some text", {
      ollamaUrl: "http://localhost:11434",
    });
    expect(result).toBeNull();
  });

  it("returns null when HTTP response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    );
    const result = await formatTranscriptWithOllama("some text", {
      ollamaUrl: "http://localhost:11434",
    });
    expect(result).toBeNull();
  });

  it("returns formatted text on successful Ollama response", async () => {
    const formattedText = "今日はプログラミングについて話します。\n\n型安全性はバグを減らし、開発効率も上がります。";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: formattedText } }),
      })
    );
    const plainText = "今日はプログラミングについて話します 型安全性はバグを減らし 開発効率も上がります";
    const result = await formatTranscriptWithOllama(plainText, {
      ollamaUrl: "http://localhost:11434",
    });
    expect(result).toBe(formattedText);
  });

  it("returns null when output is less than 70% of input length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: "short" } }),
      })
    );
    const longText = "a".repeat(100);
    const result = await formatTranscriptWithOllama(longText, {
      ollamaUrl: "http://localhost:11434",
    });
    expect(result).toBeNull();
  });
});

describe("formatTranscriptForOutput", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to mechanical when Ollama fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { formatted, rawLines } = await formatTranscriptForOutput(SAMPLE_SNIPPETS, {
      useLocalLlm: true,
      ollamaUrl: "http://localhost:11434",
    });
    expect(formatted.length).toBeGreaterThan(0);
    expect(rawLines).toHaveLength(SAMPLE_SNIPPETS.length);
    rawLines.forEach((line, i) => {
      expect(line).toContain(SAMPLE_SNIPPETS[i].text);
    });
  });

  it("uses Ollama output when available", async () => {
    // Must be >= 70% of plain text length to pass the threshold check
    const ollamaOut =
      "今日はプログラミングについて話します。特にTypeScriptの型システムが重要です。\n\n型安全性はバグを減らし、また開発効率も上がります。ぜひ試してみてください！";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: ollamaOut } }),
      })
    );
    const { formatted } = await formatTranscriptForOutput(SAMPLE_SNIPPETS, {
      useLocalLlm: true,
      ollamaUrl: "http://localhost:11434",
    });
    expect(formatted).toBe(ollamaOut);
  });

  it("rawLines contains timestamped original snippets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { rawLines } = await formatTranscriptForOutput(SAMPLE_SNIPPETS, {
      useLocalLlm: false,
    });
    expect(rawLines[0]).toMatch(/^\[00:00\]/);
    expect(rawLines[0]).toContain(SAMPLE_SNIPPETS[0].text);
  });

  it("skips Ollama when useLocalLlm is false", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await formatTranscriptForOutput(SAMPLE_SNIPPETS, { useLocalLlm: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
