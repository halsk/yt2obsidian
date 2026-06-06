import { describe, it, expect } from "vitest";
import { extractYouTubeUrl } from "./core.js";

// Web Share Target (Android) gatekeeper: extractYouTubeUrl must recognize the
// same URL shapes that extractVideoId can parse — notably youtube.com/live/...
describe("extractYouTubeUrl (Web Share Target)", () => {
  it("extracts a YouTube Live URL (regression: Android share of a Live)", () => {
    const u = "https://www.youtube.com/live/abc123XYZ_-?si=token";
    expect(extractYouTubeUrl({ text: u })).toBe(u);
  });

  it("extracts a Live URL without www", () => {
    const u = "https://youtube.com/live/abc123XYZ_-";
    expect(extractYouTubeUrl({ text: u })).toBe(u);
  });

  it("extracts an embed URL", () => {
    const u = "https://www.youtube.com/embed/dQw4w9WgXcQ";
    expect(extractYouTubeUrl({ text: u })).toBe(u);
  });

  it("extracts watch URL (existing behavior preserved)", () => {
    const u = "https://youtube.com/watch?v=dQw4w9WgXcQ&si=x";
    expect(extractYouTubeUrl({ text: u })).toBe(u);
  });

  it("extracts youtu.be URL (existing behavior preserved)", () => {
    const u = "https://youtu.be/dQw4w9WgXcQ";
    expect(extractYouTubeUrl({ text: u })).toBe(u);
  });

  it("extracts shorts URL (existing behavior preserved)", () => {
    const u = "https://youtube.com/shorts/abc123";
    expect(extractYouTubeUrl({ text: u })).toBe(u);
  });

  it("extracts a URL embedded in shared text (stops at whitespace)", () => {
    expect(
      extractYouTubeUrl({ text: "見て https://youtube.com/live/abc123 これ" })
    ).toBe("https://youtube.com/live/abc123");
  });

  it("returns null when no YouTube URL is present", () => {
    expect(extractYouTubeUrl({ text: "no link", title: "t", url: "" })).toBeNull();
  });
});
