import { describe, it, expect } from "vitest";
import { extractVideoId } from "./core.js";

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
