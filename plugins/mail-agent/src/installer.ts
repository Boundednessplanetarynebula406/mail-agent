import fs from "node:fs/promises";
import { builtinModules, createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMarketplaceRoot, getPluginInstallRoot } from "@iomancer/mail-agent-shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const bundleEntries = [
  ".codex-plugin",
  ".mcp.json",
  "assets",
  "dist",
  "package.json",
  "README.md",
  "skills"
] as const;

type Marketplace = {
  name: string;
  interface?: {
    displayName?: string;
  };
  plugins: Array<{
    name: string;
    source: {
      source: "local";
      path: string;
    };
    policy: {
      installation: "AVAILABLE";
      authentication: "ON_INSTALL";
    };
    category: string;
  }>;
};

type PackageManifest = {
  dependencies?: Record<string, string>;
  files?: string[];
  optionalDependencies?: Record<string, string>;
};

const optionalPackageMetadata = ["README.md", "LICENSE"] as const;
const nativeRuntimeArtifactGlobs = ["build/Release/**/*.node"] as const;
const fallbackPackageExcludes = new Set([
  ".github",
  ".nyc_output",
  "coverage",
  "node_modules",
  "src",
  "test",
  "tests",
  "__tests__",
  "tsconfig.json",
  "tsconfig.build.json",
  "tsconfig.cjs.json",
  "tsconfig.prod.json",
  "tsconfig.ts.json",
  "tsconfig.types.json",
  "vitest.config.js",
  "vitest.config.mjs",
  "vitest.config.ts",
  "jest.config.js",
  "jest.config.mjs",
  "jest.config.ts",
  "eslint.config.js",
  "eslint.config.mjs",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.json",
  "prettier.config.js",
  "prettier.config.mjs",
  "biome.json",
  "biome.jsonc",
  "rollup.config.js",
  "rollup.config.mjs",
  "webpack.config.js",
  "webpack.config.cjs",
  "webpack.cjs.config.js",
  "babel.config.js"
]);

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyTree(source: string, target: string): Promise<void> {
  await fs.cp(source, target, { recursive: true, force: true, dereference: true });
}

function isInsideDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveInsideDirectory(root: string, relativeEntry: string): string | undefined {
  const resolvedRoot = path.resolve(root);
  const resolvedEntry = path.resolve(resolvedRoot, relativeEntry);
  return isInsideDirectory(resolvedRoot, resolvedEntry) ? resolvedEntry : undefined;
}

function resolvePackageCopyPaths(
  sourcePackageDir: string,
  targetPackageDir: string,
  relativeEntry: string
): { sourcePath: string; targetPath: string } | undefined {
  const sourcePath = resolveInsideDirectory(sourcePackageDir, relativeEntry);
  const targetPath = resolveInsideDirectory(targetPackageDir, relativeEntry);

  if (sourcePath === undefined || targetPath === undefined) {
    return undefined;
  }

  return { sourcePath, targetPath };
}

async function copyPackageEntry(sourcePackageDir: string, targetPackageDir: string, relativeEntry: string): Promise<void> {
  const paths = resolvePackageCopyPaths(sourcePackageDir, targetPackageDir, relativeEntry);
  if (paths === undefined) {
    return;
  }

  const { sourcePath, targetPath } = paths;
  if (!(await exists(sourcePath))) {
    return;
  }

  const stat = await fs.stat(sourcePath);
  if (stat.isDirectory()) {
    await copyTree(sourcePath, targetPath);
    return;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

function normalizeManifestEntry(entry: string): string {
  return entry.replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/$/, "");
}

function hasGlob(entry: string): boolean {
  return /[*?\[\]{}]/.test(entry);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(glob: string): RegExp {
  let pattern = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === undefined) {
      continue;
    }

    const next = glob[index + 1];

    if (char === "*" && next === "*") {
      const afterGlobstar = glob[index + 2];
      if (afterGlobstar === "/") {
        pattern += "(?:.*/)?";
        index += 2;
      } else {
        pattern += ".*";
        index += 1;
      }
      continue;
    }

    if (char === "*") {
      pattern += "[^/]*";
      continue;
    }

    if (char === "?") {
      pattern += "[^/]";
      continue;
    }

    pattern += escapeRegExp(char);
  }

  return new RegExp(`${pattern}$`);
}

async function* walkPackageFiles(packageDir: string, relativeDir = ""): AsyncGenerator<string> {
  const root = resolveInsideDirectory(packageDir, relativeDir);
  if (root === undefined) {
    return;
  }

  const entries = await fs.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules") {
      continue;
    }

    const relativeEntry = relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      yield* walkPackageFiles(packageDir, relativeEntry);
      continue;
    }

    if (entry.isFile()) {
      yield relativeEntry;
    }
  }
}

async function getManifestEntryFiles(sourcePackageDir: string, entry: string): Promise<string[]> {
  if (hasGlob(entry)) {
    const matcher = globToRegExp(entry);
    const matches: string[] = [];
    for await (const relativeFile of walkPackageFiles(sourcePackageDir)) {
      if (matcher.test(relativeFile)) {
        matches.push(relativeFile);
      }
    }

    return matches;
  }

  const sourcePath = resolveInsideDirectory(sourcePackageDir, entry);
  if (sourcePath === undefined || !(await exists(sourcePath))) {
    return [];
  }

  const stat = await fs.stat(sourcePath);
  if (stat.isDirectory()) {
    const files: string[] = [];
    for await (const relativeFile of walkPackageFiles(sourcePackageDir, entry)) {
      files.push(relativeFile);
    }

    return files;
  }

  return stat.isFile() ? [entry] : [];
}

function getManifestExcludeMatchers(files: string[]): RegExp[] {
  return files
    .filter((entry) => entry.startsWith("!"))
    .map((entry) => normalizeManifestEntry(entry.slice(1)))
    .filter((entry) => entry.length > 0)
    .map((entry) => globToRegExp(entry));
}

function isManifestFileExcluded(relativeFile: string, excludeMatchers: RegExp[]): boolean {
  return excludeMatchers.some((matcher) => matcher.test(relativeFile));
}

async function copyManifestEntry(
  sourcePackageDir: string,
  targetPackageDir: string,
  entry: string,
  excludeMatchers: RegExp[]
): Promise<void> {
  for (const relativeFile of await getManifestEntryFiles(sourcePackageDir, entry)) {
    if (!isManifestFileExcluded(relativeFile, excludeMatchers)) {
      await copyPackageEntry(sourcePackageDir, targetPackageDir, relativeFile);
    }
  }
}

async function copyManifestGlob(sourcePackageDir: string, targetPackageDir: string, glob: string): Promise<void> {
  const matcher = globToRegExp(glob);

  for await (const relativeFile of walkPackageFiles(sourcePackageDir)) {
    if (matcher.test(relativeFile)) {
      await copyPackageEntry(sourcePackageDir, targetPackageDir, relativeFile);
    }
  }
}

async function copyNativeRuntimeArtifacts(sourcePackageDir: string, targetPackageDir: string): Promise<void> {
  for (const glob of nativeRuntimeArtifactGlobs) {
    await copyManifestGlob(sourcePackageDir, targetPackageDir, glob);
  }
}

async function copyPackageDirectory(source: string, target: string): Promise<void> {
  const manifest = await readPackageManifest(source);
  await fs.mkdir(target, { recursive: true });

  await copyPackageEntry(source, target, "package.json");
  for (const entry of optionalPackageMetadata) {
    await copyPackageEntry(source, target, entry);
  }
  await copyNativeRuntimeArtifacts(source, target);

  if (manifest.files && manifest.files.length > 0) {
    const excludeMatchers = getManifestExcludeMatchers(manifest.files);
    for (const rawEntry of manifest.files) {
      const entry = normalizeManifestEntry(rawEntry);
      if (!entry || entry.startsWith("!")) {
        continue;
      }

      await copyManifestEntry(source, target, entry, excludeMatchers);
    }

    return;
  }

  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "package.json" || optionalPackageMetadata.includes(entry.name as typeof optionalPackageMetadata[number])) {
      continue;
    }

    if (fallbackPackageExcludes.has(entry.name)) {
      continue;
    }

    await copyPackageEntry(source, target, entry.name);
  }
}

export const copyPackageDirectoryForTest = copyPackageDirectory;

async function readPackageManifest(packageDir: string): Promise<PackageManifest> {
  const raw = await fs.readFile(path.join(packageDir, "package.json"), "utf8");
  return JSON.parse(raw) as PackageManifest;
}

function getRuntimeDependencyNames(manifest: PackageManifest): string[] {
  return [...new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {})
  ])];
}

function isBuiltinDependency(packageName: string): boolean {
  const normalized = packageName.startsWith("node:") ? packageName.slice(5) : packageName;
  return builtinModules.includes(packageName) || builtinModules.includes(normalized);
}

async function resolveInstalledPackageDir(sourcePackageDir: string, packageName: string): Promise<string> {
  const manifestPath = await fs.realpath(path.join(sourcePackageDir, "package.json"));
  const packageRequire = createRequire(manifestPath);
  const searchRoots = packageRequire.resolve.paths(packageName) ?? [];

  for (const searchRoot of searchRoots) {
    const candidate = path.join(searchRoot, ...packageName.split("/"));
    if (await exists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate installed dependency "${packageName}" from "${sourcePackageDir}"`);
}

async function copyRuntimeDependencyGraph(
  sourcePackageDir: string,
  targetRoot: string,
  seen = new Set<string>()
): Promise<void> {
  const manifest = await readPackageManifest(sourcePackageDir);

  for (const dependencyName of getRuntimeDependencyNames(manifest)) {
    if (isBuiltinDependency(dependencyName)) {
      continue;
    }

    const sourceDependencyDir = await resolveInstalledPackageDir(sourcePackageDir, dependencyName);
    const targetDependencyDir = path.join(targetRoot, "node_modules", ...dependencyName.split("/"));
    const cycleKey = await fs.realpath(sourceDependencyDir);

    if (seen.has(cycleKey)) {
      continue;
    }

    seen.add(cycleKey);
    await copyPackageDirectory(sourceDependencyDir, targetDependencyDir);
    await copyRuntimeDependencyGraph(sourceDependencyDir, targetRoot, seen);
  }
}

async function readMarketplace(filePath: string): Promise<Marketplace> {
  if (!(await exists(filePath))) {
    return {
      name: "local-plugins",
      interface: {
        displayName: "Local Plugins"
      },
      plugins: []
    };
  }

  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as Marketplace;
}

export async function installPluginBundle(): Promise<{ pluginPath: string; marketplacePath: string }> {
  const pluginRoot = getPluginInstallRoot();
  const target = path.join(pluginRoot, "mail-agent");
  const marketplaceRoot = getMarketplaceRoot();
  const marketplacePath = path.join(marketplaceRoot, "plugins", "marketplace.json");

  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  for (const entry of bundleEntries) {
    const source = path.join(packageRoot, entry);
    const destination = path.join(target, entry);
    const stat = await fs.stat(source);
    if (stat.isDirectory()) {
      await copyTree(source, destination);
    } else {
      await fs.copyFile(source, destination);
    }
  }
  await copyRuntimeDependencyGraph(packageRoot, target);
  await fs.mkdir(path.dirname(marketplacePath), { recursive: true });

  const marketplace = await readMarketplace(marketplacePath);
  const nextEntry = {
    name: "mail-agent",
    source: {
      source: "local" as const,
      path: normalizeMarketplacePath(path.relative(marketplaceRoot, target))
    },
    policy: {
      installation: "AVAILABLE" as const,
      authentication: "ON_INSTALL" as const
    },
    category: "Productivity"
  };

  marketplace.plugins = marketplace.plugins.filter((entry) => entry.name !== "mail-agent");
  marketplace.plugins.push(nextEntry);

  await fs.writeFile(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");
  return { pluginPath: target, marketplacePath };
}

function normalizeMarketplacePath(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join("/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}
