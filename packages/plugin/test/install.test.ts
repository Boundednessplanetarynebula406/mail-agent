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

const { copyPackageDirectoryForTest, installPluginBundle } = await import("../src/installer.js");

async function expectPathAbsent(target: string): Promise<void> {
  await expect(fs.stat(target)).rejects.toMatchObject({ code: "ENOENT" });
}

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
      fs.stat(path.join(result.pluginPath, "node_modules", "@iomancer", "mail-agent-daemon", "dist"))
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(result.pluginPath, "node_modules", "@iomancer", "mail-agent-daemon", "README.md"))
    ).resolves.toBeTruthy();
    await expectPathAbsent(path.join(result.pluginPath, "node_modules", "@iomancer", "mail-agent-daemon", "src"));
    await expectPathAbsent(path.join(result.pluginPath, "node_modules", "@iomancer", "mail-agent-daemon", "test"));
    await expect(
      fs.stat(path.join(result.pluginPath, "node_modules", "@iomancer", "mail-agent-shared", "package.json"))
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(result.pluginPath, "node_modules", "@iomancer", "mail-agent-shared", "dist"))
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(result.pluginPath, "node_modules", "@iomancer", "mail-agent-shared", "README.md"))
    ).resolves.toBeTruthy();
    await expectPathAbsent(path.join(result.pluginPath, "node_modules", "@iomancer", "mail-agent-shared", "src"));
    await expectPathAbsent(path.join(result.pluginPath, "node_modules", "@iomancer", "mail-agent-shared", "test"));
    await expect(
      fs.stat(path.join(result.pluginPath, "node_modules", "@modelcontextprotocol", "sdk", "package.json"))
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(
        path.join(result.pluginPath, "node_modules", "keytar", "package.json")
      )
    ).resolves.toBeTruthy();
    const sourceKeytarNativeArtifact = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "node_modules",
      "keytar",
      "build",
      "Release",
      "keytar.node"
    );
    if (await pathExists(sourceKeytarNativeArtifact)) {
      await expect(
        fs.stat(
          path.join(result.pluginPath, "node_modules", "keytar", "build", "Release", "keytar.node")
        )
      ).resolves.toBeTruthy();
    }
  }, 20000);
});

describe("copyPackageDirectory", () => {
  afterEach(async () => {
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it("ignores manifest file entries that escape the package boundary", async () => {
    const fixtureRoot = path.join(tempHome, "escape-fixture");
    const source = path.join(fixtureRoot, "source", "package");
    const target = path.join(fixtureRoot, "target", "package");
    await fs.mkdir(path.join(source, "dist"), { recursive: true });
    await fs.writeFile(path.join(source, "package.json"), JSON.stringify({
      name: "escape-fixture",
      version: "1.0.0",
      files: ["dist", "../outside.js"]
    }));
    await fs.writeFile(path.join(source, "dist", "index.js"), "export {};\n");
    await fs.writeFile(path.join(fixtureRoot, "source", "outside.js"), "throw new Error('outside');\n");

    await copyPackageDirectoryForTest(source, target);

    await expect(fs.stat(path.join(target, "package.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(target, "dist", "index.js"))).resolves.toBeTruthy();
    await expectPathAbsent(path.join(fixtureRoot, "target", "outside.js"));
  });

  it("honors manifest file negation patterns", async () => {
    const fixtureRoot = path.join(tempHome, "negation-fixture");
    const source = path.join(fixtureRoot, "source");
    const target = path.join(fixtureRoot, "target");
    await fs.mkdir(path.join(source, "dist"), { recursive: true });
    await fs.writeFile(path.join(source, "package.json"), JSON.stringify({
      name: "negation-fixture",
      version: "1.0.0",
      files: ["dist", "!dist/private.js"]
    }));
    await fs.writeFile(path.join(source, "dist", "index.js"), "export {};\n");
    await fs.writeFile(path.join(source, "dist", "private.js"), "export const secret = true;\n");

    await copyPackageDirectoryForTest(source, target);

    await expect(fs.stat(path.join(target, "dist", "index.js"))).resolves.toBeTruthy();
    await expectPathAbsent(path.join(target, "dist", "private.js"));
  });
});

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
