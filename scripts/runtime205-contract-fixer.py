from pathlib import Path

path = Path("scripts/e2e-backend.mjs")
text = path.read_text(encoding="utf-8")

old = '''    const terminal = await waitForTerminalStatus(
      `/autonomous/status/${autonomous.sessionId}`,
      `Autonomous session ${autonomous.sessionId}`,
      ["simulated", "failed", "cancelled"],
    );
    assert(
      Array.isArray(collaboration.tasks) &&
        autonomous.sessionId &&
        autonomous.productionCompleted === false &&
        terminal.status === "simulated" &&
        terminal.executionMode === "simulation" &&
        terminal.resultAuthority === "preview-only" &&
        terminal.qualityScore === null &&
        terminal.cost?.totalCost === 0,
      "Collaboration or autonomous contract is incomplete",
    );
'''

new = '''    const terminal = await waitForTerminalStatus(
      `/autonomous/status/${autonomous.sessionId}`,
      `Autonomous session ${autonomous.sessionId}`,
      ["preview_completed", "failed", "cancelled"],
    );
    const autonomousPhases = new Map(
      terminal.phases.map((phase) => [phase.phase, phase]),
    );
    const luaPhase = autonomousPhases.get("lua_generation");
    const playtestPhase = autonomousPhases.get("playtest");
    const repairPhase = autonomousPhases.get("repair");
    const studioSyncPhase = autonomousPhases.get("studio_sync");
    assert(
      Array.isArray(collaboration.tasks) &&
        autonomous.sessionId &&
        autonomous.productionCompleted === false &&
        terminal.status === "preview_completed" &&
        terminal.executionMode === "bounded" &&
        terminal.resultAuthority === "preview-only" &&
        Number.isFinite(terminal.qualityScore) &&
        terminal.qualityScore >= 0 &&
        terminal.qualityScore <= 100 &&
        terminal.cost?.totalCost === 0 &&
        terminal.cost?.source === "measured" &&
        luaPhase?.status === "completed" &&
        luaPhase?.evidence === "verified" &&
        luaPhase?.capability === "available" &&
        playtestPhase?.status === "completed" &&
        playtestPhase?.evidence === "heuristic" &&
        playtestPhase?.capability === "degraded" &&
        playtestPhase?.output?.runtimeExecuted === false &&
        repairPhase?.status === "skipped" &&
        repairPhase?.capability === "unavailable" &&
        studioSyncPhase?.status === "skipped" &&
        studioSyncPhase?.capability === "unavailable",
      "Collaboration or autonomous contract is incomplete",
    );
'''

if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit("Autonomous contract block not found")

path.write_text(text, encoding="utf-8")
