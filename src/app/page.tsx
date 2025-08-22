"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Home() {
  const userId = "demo"; // sub in auth later
  const [input, setInput] = useState("");

  const messages = useQuery(api.messages.list, { userId }) ?? [];
  const addMessage = useMutation(api.messages.insertMessage);

  async function send() {
    const userMsg = { role: "user", content: input };
    await addMessage({ userId, ...userMsg });

    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [...messages.map(m => ({ role: m.role, content: m.content })), userMsg] }),
    });
    const json = await res.json();
    const assistantText =
      typeof json?.content === "string"
        ? json.content
        : JSON.stringify(json);

    await addMessage({ userId, role: "assistant", content: assistantText });
    setInput("");
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="space-y-2">
        {messages.slice().reverse().map(m => (
          <div key={m._id} className="text-sm">
            <b>{m.role}:</b> {m.content}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input className="border px-3 py-2 flex-1" value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask for flights..." />
        <button className="px-4 py-2 bg-black text-white rounded" onClick={send}>Send</button>
      </div>
    </main>
  );
}
