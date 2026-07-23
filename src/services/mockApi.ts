// Simulated async API layer. FUTURE INTEGRATION: replace these mock
// implementations with real backend / AI pipeline calls. The function
// signatures are intentionally close to a real REST/RPC client.

export const delay = (ms = 600) => new Promise((res) => setTimeout(res, ms));

export async function mockRequest<T>(data: T, ms = 600): Promise<T> {
  await delay(ms);
  return data;
}

const ASSISTANT_REPLIES = [
  "I've added that to the game design. The Builder agent will pick it up in the next pass.",
  "Good call — that improves the core loop. I'll have the Lua agent script the new behavior.",
  "Done. I balanced the values so progression stays smooth for new players.",
  "I can generate that as a separate module so it's easy to toggle. Shall I queue it?",
  "Noted. This pairs well with the rebirth system you already have configured.",
];

export async function mockAssistantReply(prompt: string): Promise<string> {
  await delay(900);
  const base = ASSISTANT_REPLIES[Math.floor(Math.random() * ASSISTANT_REPLIES.length)];
  return `${base}\n\n(Preview response — the AI generation pipeline is not connected yet.)\n\nYour request: "${prompt}"`;
}
