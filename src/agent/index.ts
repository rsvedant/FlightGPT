import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { BaseMessage } from "@langchain/core/messages";

export async function buildAgent() {
  const client = new MultiServerMCPClient({
    throwOnLoadError: true,
    useStandardContentBlocks: true,
    mcpServers: {
      flights: {
        url: process.env.FLIGHTS_MCP_URL!,
      },
    },
  });

  const tools = await client.getTools();
  console.log("Loaded tools:", tools.map(t => t.name));

  const baseLlm = new ChatOpenAI({
    model: "z-ai/glm-4.5-air:free",
    temperature: 0.5,
    apiKey: process.env.OPENROUTER_API_KEY!,
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
  });
  const llm = baseLlm.bindTools(tools, { tool_choice: "auto" });

  const systemPrompt = `
You are **FlightGPT**, a flights planning agent for web and voice.

Core rule: When the user asks for flights, fares, date grids, or “cheapest day”, **use the Flights MCP tools first** and base your answer on tool results. Do not guess prices. If tools fail, briefly say so and suggest a next step.

Context & behavior:
- Tool awareness: You are connected to an MCP server named "flights". Inspect the available tool names and choose the best one for the user’s goal (e.g., search, month/price calendar, cheapest, details).
- Clarify only when blocking info is missing (origin, destination, date(s) or month, one-way/round-trip, cabin, max stops/layover, budget, preferred airlines). Otherwise proceed with sensible defaults and call the tool.
- For month-only requests, prefer calendar/cheapest-by-day style tools if available.
- Keep calls efficient: start with 1 tool call; if the tool returns multiple options, optionally make **at most one** follow-up tool call to refine (e.g., sort by price or filter).
- Output style:
  1) A short, user-friendly summary of the best option(s).
  2) A compact list of top alternatives (price, airline(s), total duration, stops, layover hubs).
  3) A **machine-readable JSON** block named "flight_choices" with fields:
     [{ date, price, currency, airlineCodes, flightNumbers, depart, arrive, durationMinutes, stops, layovers, bookingUrl? }]
- Note volatility: “Prices are live and can change.” Encourage the user to confirm before booking.
- If the user asks for general tactics (not specific search), you may answer directly without tools.
- Safety: Don’t claim hidden availability. Don’t invent airlines, prices, or links.
- Be concise. Avoid unnecessary hedging or explanations.

Examples of when to call tools immediately:
- “Cheapest one-way SFO→DEL in May 2026”
- “Show me a price calendar for NYC→LON next March”
- “Under $700, 1 stop max, midweek dates”
  `.trim();

  const stateModifier = (state: { messages: BaseMessage[] }) => {
    return [
      { role: "system", content: systemPrompt },
      ...state.messages,
    ];
  };

  const agent = createReactAgent({
    llm,
    tools,
    stateModifier,
  });

  return { agent, client }; 
}
