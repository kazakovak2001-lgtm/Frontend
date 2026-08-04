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
  process.env.INTEGRATION_BACKEND_DIR ??
    resolve(frontendRoot, "../RobloxAIStudio2"),
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

function normalizeRepository(value) {
  return value
    .trim()
    .replace(/^git@github\.com:/, "")
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
}

function assertExactArray(actual, expected, name) {
  if (
    !Array.isArray(actual) ||
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    fail(`${name} must equal ${JSON.stringify(expected)}`);
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

assertExactArray(
  manifest.contract?.requiredTransports,
  ["https", "socket.io"],
  "contract.requiredTransports",
);
if (manifest.contract?.authentication !== "credentialed-rbac") {
  fail("contract.authentication must equal credentialed-rbac");
}

await assertFile(resolve(frontendRoot, ".git"), "Frontend checkout");
await assertFile(resolve(backendRoot, ".git"), "Backend checkout");

const expectedFrontendSha = process.env.INTEGRATION_FRONTEND_SHA;
const expectedBackendSha =
  process.env.INTEGRATION_BACKEND_SHA ?? manifest.backend?.candidateSha;
assertSha(expectedFrontendSha, "INTEGRATION_FRONTEND_SHA");
assertSha(expectedBackendSha, "INTEGRATION_BACKEND_SHA");
assertSha(manifest.backend?.candidateSha, "manifest.backend.candidateSha");
if (expectedBackendSha !== manifest.backend.candidateSha) {
  fail(
    `Backend manifest mismatch: expected ${manifest.backend.candidateSha}, received ${expectedBackendSha}`,
  );
}

const actualFrontendSha = git(frontendRoot, "rev-parse", "HEAD");
const actualBackendSha = git(backendRoot, "rev-parse", "HEAD");
if (actualFrontendSha !== expectedFrontendSha) {
  fail(
    `Frontend SHA mismatch: expected ${expectedFrontendSha}, received ${actualFrontendSha}`,
  );
}
if (actualBackendSha !== expectedBackendSha) {
  fail(
    `Backend SHA mismatch: expected ${expectedBackendSha}, received ${actualBackendSha}`,
  );
}

const actualFrontendRepository = normalizeRepository(
  git(frontendRoot, "remote", "get-url", "origin"),
);
const actualBackendRepository = normalizeRepository(
  git(backendRoot, "remote", "get-url", "origin"),
);
const expectedFrontendRepository = normalizeRepository(
  manifest.frontend?.repository ?? "",
);
const expectedBackendRepository = normalizeRepository(
  manifest.backend?.repository ?? "",
);
if (actualFrontendRepository !== expectedFrontendRepository) {
  fail(
    `Frontend repository mismatch: expected ${expectedFrontendRepository}, received ${actualFrontendRepository}`,
  );
}
if (actualBackendRepository !== expectedBackendRepository) {
  fail(
    `Backend repository mismatch: expected ${expectedBackendRepository}, received ${actualBackendRepository}`,
  );
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
  await assertFile(
    resolve(frontendRoot, path),
    `Frontend runtime client ${path}`,
  );
}

console.log(
  JSON.stringify(
    {
      delivery: manifest.delivery,
      frontend: {
        repository: expectedFrontendRepository,
        sha: actualFrontendSha,
      },
      backend: {
        repository: expectedBackendRepository,
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
