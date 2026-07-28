from pathlib import Path


path = Path("scripts/e2e-backend.mjs")
text = path.read_text()

if (
    'terminalStatuses = ["completed", "failed", "cancelled"]' in text
    and 'autonomous.productionCompleted === false' in text
):
    raise SystemExit(0)

replacements = [
    (
        """async function waitForTerminalStatus(path, label) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await request(path);
    if ([\"completed\", \"failed\", \"cancelled\"].includes(state.status)) {
      return state;
    }
""",
        """async function waitForTerminalStatus(
  path,
  label,
  terminalStatuses = [\"completed\", \"failed\", \"cancelled\"],
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await request(path);
    if (terminalStatuses.includes(state.status)) {
      return state;
    }
""",
    ),
    (
        """    const terminal = await waitForTerminalStatus(
      `/autonomous/status/${autonomous.sessionId}`,
      `Autonomous session ${autonomous.sessionId}`,
    );
""",
        """    const terminal = await waitForTerminalStatus(
      `/autonomous/status/${autonomous.sessionId}`,
      `Autonomous session ${autonomous.sessionId}`,
      [\"simulated\", \"failed\", \"cancelled\"],
    );
""",
    ),
    (
        """      Array.isArray(collaboration.tasks) &&
        autonomous.sessionId &&
        terminal.status === \"completed\",
""",
        """      Array.isArray(collaboration.tasks) &&
        autonomous.sessionId &&
        autonomous.productionCompleted === false &&
        terminal.status === \"simulated\" &&
        terminal.executionMode === \"simulation\" &&
        terminal.resultAuthority === \"preview-only\" &&
        terminal.qualityScore === null &&
        terminal.cost?.totalCost === 0,
""",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f"Expected contract block not found: {old[:80]!r}")
    text = text.replace(old, new, 1)

path.write_text(text)
