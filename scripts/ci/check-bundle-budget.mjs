import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const configPath = path.resolve(
  root,
  process.env.BUNDLE_BUDGET_CONFIG ?? "config/bundle-budget.json",
);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function ensurePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}

function createViolation(metric, actual, budget) {
  return {
    metric,
    actual,
    budget,
    overBy: actual - budget,
  };
}

async function main() {
  const config = await readJson(configPath);
  if (config.schemaVersion !== 1) {
    throw new Error(
      `Unsupported bundle budget schema: ${config.schemaVersion}`,
    );
  }

  const assetsRoot = path.resolve(root, config.assetsRoot);
  const evidencePath = path.resolve(root, config.evidencePath);
  const budgets = config.budgets ?? {};

  for (const field of [
    "maxClientAssetBytes",
    "maxClientJsBytes",
    "maxClientJsGzipBytes",
    "maxClientJsChunkBytes",
    "maxClientJsChunkGzipBytes",
    "maxClientCssBytes",
  ]) {
    ensurePositiveInteger(budgets[field], `budgets.${field}`);
  }

  const assetsStat = await stat(assetsRoot).catch(() => null);
  if (!assetsStat?.isDirectory()) {
    throw new Error(
      `Bundle assets directory does not exist: ${path.relative(root, assetsRoot)}`,
    );
  }

  const absoluteFiles = await collectFiles(assetsRoot);
  const files = await Promise.all(
    absoluteFiles.map(async (absolutePath) => {
      const data = await readFile(absolutePath);
      const relativePath = path
        .relative(root, absolutePath)
        .replaceAll("\\", "/");
      const extension = path.extname(absolutePath).toLowerCase();
      return {
        path: relativePath,
        extension,
        bytes: data.byteLength,
        gzipBytes:
          extension === ".js" ? gzipSync(data, { level: 9 }).byteLength : null,
      };
    }),
  );

  files.sort(
    (left, right) =>
      right.bytes - left.bytes || left.path.localeCompare(right.path),
  );
  const jsFiles = files.filter((file) => file.extension === ".js");
  const cssFiles = files.filter((file) => file.extension === ".css");

  if (jsFiles.length === 0) {
    throw new Error(
      `No client JavaScript assets found in ${config.assetsRoot}`,
    );
  }

  const largestJsChunk = jsFiles[0];
  const metrics = {
    clientAssetBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    clientJsBytes: jsFiles.reduce((sum, file) => sum + file.bytes, 0),
    clientJsGzipBytes: jsFiles.reduce(
      (sum, file) => sum + (file.gzipBytes ?? 0),
      0,
    ),
    largestClientJsChunkBytes: largestJsChunk.bytes,
    largestClientJsChunkGzipBytes: largestJsChunk.gzipBytes ?? 0,
    clientCssBytes: cssFiles.reduce((sum, file) => sum + file.bytes, 0),
    clientAssetCount: files.length,
    clientJsChunkCount: jsFiles.length,
    clientCssAssetCount: cssFiles.length,
  };

  const checks = [
    ["clientAssetBytes", metrics.clientAssetBytes, budgets.maxClientAssetBytes],
    ["clientJsBytes", metrics.clientJsBytes, budgets.maxClientJsBytes],
    [
      "clientJsGzipBytes",
      metrics.clientJsGzipBytes,
      budgets.maxClientJsGzipBytes,
    ],
    [
      "largestClientJsChunkBytes",
      metrics.largestClientJsChunkBytes,
      budgets.maxClientJsChunkBytes,
    ],
    [
      "largestClientJsChunkGzipBytes",
      metrics.largestClientJsChunkGzipBytes,
      budgets.maxClientJsChunkGzipBytes,
    ],
    ["clientCssBytes", metrics.clientCssBytes, budgets.maxClientCssBytes],
  ];
  const violations = checks
    .filter(([, actual, budget]) => actual > budget)
    .map(([metric, actual, budget]) => createViolation(metric, actual, budget));

  const evidence = {
    schemaVersion: 1,
    status: violations.length === 0 ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    commitSha: process.env.GITHUB_SHA ?? null,
    configPath: path.relative(root, configPath).replaceAll("\\", "/"),
    assetsRoot: config.assetsRoot,
    budgets,
    baseline: config.baseline ?? null,
    metrics,
    largestClientJsChunks: jsFiles.slice(0, 10),
    violations,
  };

  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(
    evidencePath,
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  console.log("Frontend bundle budget");
  console.log(
    `  assets: ${metrics.clientAssetBytes} / ${budgets.maxClientAssetBytes}`,
  );
  console.log(
    `  JS raw: ${metrics.clientJsBytes} / ${budgets.maxClientJsBytes}`,
  );
  console.log(
    `  JS gzip: ${metrics.clientJsGzipBytes} / ${budgets.maxClientJsGzipBytes}`,
  );
  console.log(
    `  largest JS: ${metrics.largestClientJsChunkBytes} / ${budgets.maxClientJsChunkBytes} (${largestJsChunk.path})`,
  );
  console.log(
    `  largest JS gzip: ${metrics.largestClientJsChunkGzipBytes} / ${budgets.maxClientJsChunkGzipBytes}`,
  );
  console.log(
    `  CSS: ${metrics.clientCssBytes} / ${budgets.maxClientCssBytes}`,
  );
  console.log(`  evidence: ${config.evidencePath}`);

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `Bundle budget exceeded: ${violation.metric}=${violation.actual}, budget=${violation.budget}, overBy=${violation.overBy}`,
      );
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
