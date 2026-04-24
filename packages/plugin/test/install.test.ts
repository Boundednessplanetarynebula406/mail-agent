import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempHome = path.join(os.tmpdir(), "mail-agent-install-test");
vi.mock("@iomancer/mail-agent-shared", async () => {
  const actual = await vi.importActual<typeof import("@iomancer/mail-agent-shared")>("@iomancer/mail-agent-shared");
  return {
    ...actual,
    getMarketplaceRoot: () => path.join(tempHome, ".agents"),
    getPluginInstallRoot: () => path.join(tempHome, ".codex", "plugins")
  };
});

const { installPluginBundle } = await import("../src/installer.js");

describe("installPluginBundle", () => {
  afterEach(async () => {
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it("keeps the plugin manifest paths aligned with the Codex plugin layout", async () => {
    const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
      name?: string;
      version?: string;
      description?: string;
      skills?: string;
      mcpServers?: string;
      interface?: {
        composerIcon?: string;
        logo?: string;
      };
    };
    const codexPluginEntries = await fs.readdir(path.join(pluginRoot, ".codex-plugin"));

    expect(manifest.name).toBe("mail-agent");
    expect(manifest.version).toBeTruthy();
    expect(manifest.description).toBeTruthy();
    expect(codexPluginEntries).toEqual(["plugin.json"]);
    expect(manifest.skills?.startsWith("./")).toBe(true);
    expect(manifest.mcpServers?.startsWith("./")).toBe(true);
    expect(manifest.interface?.composerIcon?.startsWith("./assets/")).toBe(true);
    expect(manifest.interface?.logo?.startsWith("./assets/")).toBe(true);
    expect((await fs.stat(path.resolve(pluginRoot, manifest.skills ?? ""))).isDirectory()).toBe(true);
    expect((await fs.stat(path.resolve(pluginRoot, manifest.mcpServers ?? ""))).isFile()).toBe(true);
    expect((await fs.stat(path.resolve(pluginRoot, manifest.interface?.composerIcon ?? ""))).isFile()).toBe(true);
    expect((await fs.stat(path.resolve(pluginRoot, manifest.interface?.logo ?? ""))).isFile()).toBe(true);
  });

  it("writes the plugin bundle and marketplace entry", async () => {
    const result = await installPluginBundle();
    const raw = await fs.readFile(result.marketplacePath, "utf8");
    const marketplace = JSON.parse(raw) as {
      plugins: Array<{
        name: string;
        source: {
          path: string;
        };
      }>;
    };
    const marketplaceRoot = path.dirname(path.dirname(result.marketplacePath));
    const entry = marketplace.plugins.find((plugin) => plugin.name === "mail-agent");

    expect(entry).toBeTruthy();
    expect(path.resolve(marketplaceRoot, entry?.source.path ?? "")).toBe(result.pluginPath);
    await expect(fs.stat(result.pluginPath)).resolves.toBeTruthy();
    await expect(fs.stat(path.join(result.pluginPath, "node_modules", "commander", "package.json"))).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(result.pluginPath, "node_modules", "@iomancer", "mail-agent-daemon", "package.json"))
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(result.pluginPath, "node_modules", "@modelcontextprotocol", "sdk", "package.json"))
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(
        path.join(result.pluginPath, "node_modules", "keytar", "package.json")
      )
    ).resolves.toBeTruthy();
  }, 20000);
});
