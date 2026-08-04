import { chromium } from "playwright";

const frontendOrigin = process.env.E2E_FRONTEND_ORIGIN;
const expectedApiUrl = process.env.E2E_API_URL;

if (!frontendOrigin || !expectedApiUrl) {
  throw new Error("E2E_FRONTEND_ORIGIN and E2E_API_URL are required");
}

const expectedSessionUrl = `${expectedApiUrl.replace(/\/$/, "")}/platform/auth/me`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  const sessionRequest = page.waitForRequest(
    (request) => request.url() === expectedSessionUrl,
    { timeout: 15_000 },
  );

  await page.goto(frontendOrigin, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  const request = await sessionRequest;
  if (request.method() !== "GET") {
    throw new Error(
      `Expected GET ${expectedSessionUrl}, received ${request.method()}`,
    );
  }

  const documentTitle = await page.title();
  if (!documentTitle.toLowerCase().includes("roblox")) {
    throw new Error(`Unexpected frontend document title: ${documentTitle}`);
  }

  process.stdout.write(
    `${JSON.stringify({
      frontendOrigin,
      expectedSessionUrl,
      requestMethod: request.method(),
      documentTitle,
    })}\n`,
  );
} finally {
  await browser.close();
}
