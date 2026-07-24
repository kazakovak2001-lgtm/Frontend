import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChatMessage, Project } from "@/types";
import { backendApi } from "@/services/backendApi";
import { toast } from "sonner";

export function ChatPanel({ project }: { project: Project }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    backendApi.workspace.chat
      .history(project.id)
      .then(async (history) => {
        if (!history[0]) return;
        const conversation = await backendApi.workspace.chat.conversation(
          history[0].id,
        );
        if (!active) return;
        setConversationId(conversation.id);
        setMessages(
          conversation.messages
            .filter((message) => message.role !== "system")
            .map((message) => ({
              id: message.id,
              role: message.role === "user" ? "user" : "assistant",
              content: message.content,
              createdAt: message.createdAt,
            })),
        );
      })
      .catch((error) => console.warn("[chat] history load failed", error))
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [project.id]);

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    const userMsg: ChatMessage = {
      id: "m_" + Date.now(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setThinking(true);
    try {
      const savedUser = await backendApi.workspace.chat.saveMessage({
        conversationId,
        projectId: conversationId ? undefined : project.id,
        role: "user",
        content: text,
      });
      const activeConversationId = conversationId ?? savedUser.conversationId;
      setConversationId(activeConversationId);

      const response = await backendApi.ai.chat(nextMessages, project);
      const savedAssistant = await backendApi.workspace.chat.saveMessage({
        conversationId: activeConversationId,
        role: "assistant",
        content: response.content,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: savedAssistant.id,
          role: "assistant",
          content: savedAssistant.content,
          createdAt: savedAssistant.createdAt,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: "error_" + Date.now(),
          role: "assistant",
          content:
            error instanceof Error
              ? "Backend error: " + error.message
              : "Backend error.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  };

  const clearConversation = async () => {
    try {
      if (conversationId) {
        await backendApi.workspace.chat.removeConversation(conversationId);
      }
      setConversationId(undefined);
      setMessages([]);
      toast.success("Conversation cleared.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Conversation clear failed.",
      );
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl border border-border/60 bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {loadingHistory ? "Loading conversation…" : "Project conversation"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={!messages.length || thinking}
          onClick={() => void clearConversation()}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
        </Button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!loadingHistory && messages.length === 0 && (
          <div className="mx-auto max-w-md py-12 text-center text-sm text-muted-foreground">
            Ask the AI to design, change, review, or generate something for{" "}
            <span className="font-medium text-foreground">{project.name}</span>.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-3",
              m.role === "user" && "flex-row-reverse",
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold",
                  m.role === "assistant"
                    ? "bg-gradient-primary text-primary-foreground"
                    : "bg-accent",
                )}
              >
                {m.role === "assistant" ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  "You"
                )}
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1 rounded-2xl bg-secondary px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-glow-pulse rounded-full bg-muted-foreground"
                  style={{ animationDelay: i * 0.2 + "s" }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask the AI to change something in your game…"
            className="max-h-32 min-h-[44px] resize-none border-border/60 bg-background/60"
          />
          <Button
            onClick={() => void send()}
            disabled={!input.trim() || thinking || loadingHistory}
            size="icon"
            className="h-11 w-11 shrink-0 bg-gradient-primary text-primary-foreground shadow-glow"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Connected to the Roblox AI Studio backend.
        </p>
      </div>
    </div>
  );
}
