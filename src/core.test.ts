import { describe, it, expect } from "vitest";
import {
  extractVideoId,
  extractYouTubeUrl,
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
  it("returns empty string for empty snippets", () => {
    expect(formatTranscriptMechanical([])).toBe("");
  });

  it("single snippet returns one paragraph with [00:00] prefix", () => {
    const result = formatTranscriptMechanical([{ text: "Hello world.", start: 0 }]);
    expect(result).toBe("[00:00] Hello world.");
  });

  it("timestamp format: 0 seconds -> [00:00]", () => {
    const result = formatTranscriptMechanical([{ text: "test", start: 0 }]);
    expect(result).toMatch(/^\[00:00\]/);
  });

  it("timestamp format: 90 seconds -> [01:30]", () => {
    const result = formatTranscriptMechanical([{ text: "test", start: 90 }]);
    expect(result).toMatch(/^\[01:30\]/);
  });

  it("gap >= 30s triggers new paragraph", () => {
    const snippets: TranscriptSnippet[] = [
      { text: "first", start: 0 },
      { text: "second", start: 31 },
    ];
    const result = formatTranscriptMechanical(snippets);
    const paragraphs = result.split("\n\n");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toMatch(/^\[00:00\]/);
    expect(paragraphs[1]).toMatch(/^\[00:31\]/);
  });

  it("gap < 30s keeps snippets in same paragraph", () => {
    const snippets: TranscriptSnippet[] = [
      { text: "first ", start: 0 },
      { text: "second ", start: 10 },
      { text: "third", start: 20 },
    ];
    const result = formatTranscriptMechanical(snippets);
    const paragraphs = result.split("\n\n");
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toContain("first");
    expect(paragraphs[0]).toContain("second");
    expect(paragraphs[0]).toContain("third");
  });

  it("exactly 30s gap triggers new paragraph (>= threshold)", () => {
    const snippets: TranscriptSnippet[] = [
      { text: "a", start: 0 },
      { text: "b", start: 30 },
    ];
    const result = formatTranscriptMechanical(snippets);
    expect(result.split("\n\n")).toHaveLength(2);
  });

  it("20 snippets close together stays in one paragraph (size limit at >= 20)", () => {
    const snippets: TranscriptSnippet[] = Array.from({ length: 20 }, (_, i) => ({
      text: `s${i} `,
      start: i,
    }));
    const result = formatTranscriptMechanical(snippets);
    expect(result.split("\n\n")).toHaveLength(1);
  });

  it("21 snippets close together splits into 2 paragraphs at the 20-snippet limit", () => {
    const snippets: TranscriptSnippet[] = Array.from({ length: 21 }, (_, i) => ({
      text: `s${i} `,
      start: i,
    }));
    const result = formatTranscriptMechanical(snippets);
    const paragraphs = result.split("\n\n");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toMatch(/^\[00:00\]/);
    expect(paragraphs[1]).toMatch(/^\[00:20\]/);
  });

  it("paragraphs joined with \\n\\n (blank line separator)", () => {
    const snippets: TranscriptSnippet[] = [
      { text: "first", start: 0 },
      { text: "second", start: 60 },
    ];
    const result = formatTranscriptMechanical(snippets);
    expect(result).toContain("\n\n");
    expect(result.split("\n\n")).toHaveLength(2);
  });

  it("text whitespace is normalized within paragraph", () => {
    const snippets: TranscriptSnippet[] = [
      { text: "hello  world", start: 0 },
      { text: "  extra  spaces  ", start: 5 },
    ];
    const result = formatTranscriptMechanical(snippets);
    // Should not have consecutive whitespace after normalization
    expect(result).not.toMatch(/[^\S\n]{2,}/);
  });

  it("paragraph timestamp is from the first snippet in the chunk", () => {
    const snippets: TranscriptSnippet[] = [
      { text: "one ", start: 65 },
      { text: "two", start: 70 },
    ];
    const result = formatTranscriptMechanical(snippets);
    expect(result).toMatch(/^\[01:05\]/);
  });

  it("chunkBySeconds option overrides default 30s threshold", () => {
    const snippets: TranscriptSnippet[] = [
      { text: "a", start: 0 },
      { text: "b", start: 10 },
    ];
    const result = formatTranscriptMechanical(snippets, { chunkBySeconds: 5 });
    expect(result.split("\n\n")).toHaveLength(2);
  });

  it("chunkBySnippets option overrides default 20-snippet limit", () => {
    const snippets: TranscriptSnippet[] = Array.from({ length: 5 }, (_, i) => ({
      text: `s${i} `,
      start: i,
    }));
    const result = formatTranscriptMechanical(snippets, { chunkBySnippets: 3 });
    expect(result.split("\n\n")).toHaveLength(2);
  });

  it("contains TypeScript content from sample snippets", () => {
    const result = formatTranscriptMechanical(SAMPLE_SNIPPETS);
    expect(result).toContain("TypeScript");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatTranscriptForOutput", () => {
  it("formatted is a non-empty string with [mm:ss] timestamp prefix", async () => {
    const { formatted } = await formatTranscriptForOutput(SAMPLE_SNIPPETS);
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toMatch(/^\[00:00\]/);
  });

  it("formatted paragraphs are separated by blank lines", async () => {
    const snippets: TranscriptSnippet[] = [
      { text: "first", start: 0 },
      { text: "second", start: 60 },
    ];
    const { formatted } = await formatTranscriptForOutput(snippets);
    expect(formatted.split("\n\n")).toHaveLength(2);
  });

  it("returns only formatted key (no rawLines)", async () => {
    const result = await formatTranscriptForOutput(SAMPLE_SNIPPETS);
    expect(Object.keys(result)).toEqual(["formatted"]);
  });
});

describe("extractYouTubeUrl", () => {
  it("extracts from url field (standard watch URL)", () => {
    expect(extractYouTubeUrl({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }))
      .toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("extracts from text field (youtu.be short URL)", () => {
    expect(extractYouTubeUrl({ text: "Check this out https://youtu.be/dQw4w9WgXcQ !" }))
      .toBe("https://youtu.be/dQw4w9WgXcQ");
  });

  it("extracts from text field (shorts URL)", () => {
    expect(extractYouTubeUrl({ text: "https://www.youtube.com/shorts/abc123XYZ" }))
      .toBe("https://www.youtube.com/shorts/abc123XYZ");
  });

  it("prefers text over url field", () => {
    expect(extractYouTubeUrl({
      text: "https://youtu.be/fromText",
      url: "https://www.youtube.com/watch?v=fromUrl",
    })).toBe("https://youtu.be/fromText");
  });

  it("returns null when no YouTube URL found", () => {
    expect(extractYouTubeUrl({ url: "https://example.com", text: "no youtube here" }))
      .toBeNull();
  });

  it("returns null for empty fields", () => {
    expect(extractYouTubeUrl({})).toBeNull();
  });
});
