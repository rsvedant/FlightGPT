import { NextRequest, NextResponse } from "next/server";
import { buildAgent } from "@/agent/index";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessageLike,
} from "@langchain/core/messages";

export const runtime = "nodejs";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;                 
  tool_call_id?: string | undefined; 
  name?: string | undefined;
  additional_kwargs?: Record<string, any>;
};

function normalizeContent(c: unknown): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("");
  if (c && typeof c === "object") return JSON.stringify(c);
  return String(c ?? "");
}

function toLCMessage(m: ChatMessage): BaseMessageLike {
  const content = normalizeContent(m.content);
  switch (m.role) {
    case "system":
      return new SystemMessage({ content, name: m.name, additional_kwargs: m.additional_kwargs });
    case "assistant":
      return new AIMessage({ content, additional_kwargs: m.additional_kwargs });
    case "tool":
      return new ToolMessage({ content, tool_call_id: m.tool_call_id ?? "tool-call" });
    case "user":
    default:
      return new HumanMessage({ content, name: m.name, additional_kwargs: m.additional_kwargs });
  }
}

function contentToString(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // LangChain content blocks: [{type:"text", text:"..."}, ...]
    return content
      .map((part: any) => (typeof part === "string" ? part : part?.text ?? part?.content ?? ""))
      .join("");
  }
  return typeof content === "object" ? JSON.stringify(content) : String(content ?? "");
}

export async function POST(req: NextRequest) {
  let cleanup: null | (() => Promise<void>) = null;

  try {
    const { messages = [] } = (await req.json()) as { messages: ChatMessage[] };

    // Normalize to BaseMessageLike[]
    const lcMessages = messages.map(toLCMessage);

    const { agent, client } = await buildAgent();
    cleanup = async () => {
      try {
        await client.close();
      } catch {}
    };

    // LangGraph prebuilt ReAct agent expects { messages: BaseMessageLike[] }
    // and returns a state with `messages: BaseMessage[]`
    const result = await agent.invoke({ messages: lcMessages });

    const out = Array.isArray((result as any)?.messages) ? (result as any).messages : [];
    const last =
      [...out].reverse().find((m: any) => m?.role === "assistant" || m?._getType?.() === "ai") ??
      out[out.length - 1];

    const content = contentToString(last?.content);

    return NextResponse.json({ content }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "unknown_error" }, { status: 500 });
  } finally {
    if (cleanup) await cleanup();
  }
}
