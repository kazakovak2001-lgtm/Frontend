import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = resolve(
  frontendRoot,
  "config/integration/paired-release.json",
);
const backendRoot = resolve(
  process.env.INTEGRATION_BACKEND_DIR ?? resolve(frontendRoot, "../RobloxAIStudio2"),
);

function fail(message) {
  throw new Error(`[INTEGRATION-1A] ${message}`);
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function assertSha(value, name) {
  if (!/^[0-9a-f]{40}$/i.test(value ?? "")) {
    fail(`${name} must be an exact 40-character commit SHA`);
  }
}

async function assertFile(path, label) {
  try {
    await access(path);
  } catch {
    fail(`${label} is missing: ${path}`);
  }
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.schemaVersion !== 1 || manifest.delivery !== "INTEGRATION-1A") {
  fail("paired-release manifest identity is invalid");
}

await assertFile(resolve(frontendRoot, ".git"), "Frontend checkout");
await assertFile(resolve(backendRoot, ".git"), "Backend checkout");

const expectedFrontendSha = process.env.INTEGRATION_FRONTEND_SHA;
const expectedBackendSha =
  process.env.INTEGRATION_BACKEND_SHA ?? manifest.backend?.candidateSha;
assertSha(expectedFrontendSha, "INTEGRATION_FRONTEND_SHA");
assertSha(expectedBackendSha, "INTEGRATION_BACKEND_SHA");

const actualFrontendSha = git(frontendRoot, "rev-parse", "HEAD");
const actualBackendSha = git(backendRoot, "rev-parse", "HEAD");
if (actualFrontendSha !== expectedFrontendSha) {
  fail(`Frontend SHA mismatch: expected ${expectedFrontendSha}, received ${actualFrontendSha}`);
}
if (actualBackendSha !== expectedBackendSha) {
  fail(`Backend SHA mismatch: expected ${expectedBackendSha}, received ${actualBackendSha}`);
}

for (const [label, root] of [
  ["Frontend", frontendRoot],
  ["Backend", backendRoot],
]) {
  const status = git(root, "status", "--porcelain");
  if (status) fail(`${label} checkout is not clean`);
}

for (const path of manifest.contract.backendPaths ?? []) {
  await assertFile(resolve(backendRoot, path), `Backend contract ${path}`);
}
for (const path of [
  manifest.contract.restClient,
  manifest.contract.realtimeClient,
]) {
  await assertFile(resolve(frontendRoot, path), `Frontend runtime client ${path}`);
}

console.log(
  JSON.stringify(
    {
      delivery: manifest.delivery,
      frontend: {
        repository: manifest.frontend.repository,
        sha: actualFrontendSha,
      },
      backend: {
        repository: manifest.backend.repository,
        sha: actualBackendSha,
      },
      transports: manifest.contract.requiredTransports,
      authentication: manifest.contract.authentication,
      status: "verified",
    },
    null,
    2,
  ),
);
