import { describe, it, expect } from "vitest";
import { resolveOutputDir, resolveVaultDir, syncObsidianVault } from "./core.js";

describe("resolveOutputDir", () => {
  it("uses OBSIDIAN_OUTPUT_DIR when set", () => {
    expect(resolveOutputDir({ OBSIDIAN_OUTPUT_DIR: "/tmp/vault/raw" })).toBe("/tmp/vault/raw");
  });

  it("preserves paths containing spaces", () => {
    const p = "/Users/hal/Documents/Main Obsidian/raw/articles";
    expect(resolveOutputDir({ OBSIDIAN_OUTPUT_DIR: p })).toBe(p);
  });

  it("falls back to HOME-based default when unset", () => {
    expect(resolveOutputDir({ HOME: "/home/x" })).toBe(
      "/home/x/workspace/obsidian/raw/articles"
    );
  });
});

describe("resolveVaultDir", () => {
  it("uses OBSIDIAN_VAULT_DIR when set", () => {
    const p = "/Users/hal/Documents/Main Obsidian";
    expect(resolveVaultDir({ OBSIDIAN_VAULT_DIR: p })).toBe(p);
  });

  it("falls back to HOME-based default when unset", () => {
    expect(resolveVaultDir({ HOME: "/home/x" })).toBe("/home/x/workspace/obsidian");
  });
});

describe("syncObsidianVault", () => {
  it("skips git sync when OBSIDIAN_SKIP_GIT_SYNC=1 (no git commands run)", () => {
    const prev = process.env.OBSIDIAN_SKIP_GIT_SYNC;
    process.env.OBSIDIAN_SKIP_GIT_SYNC = "1";
    try {
      const logs: string[] = [];
      syncObsidianVault((m) => logs.push(m));
      expect(logs.some((l) => l.toLowerCase().includes("skip"))).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.OBSIDIAN_SKIP_GIT_SYNC;
      else process.env.OBSIDIAN_SKIP_GIT_SYNC = prev;
    }
  });
});
