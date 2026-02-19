/**
 * /api/generate — Clean proxy from Next.js frontend to the Python A2A agent.
 */

import { NextRequest, NextResponse } from "next/server";

const A2A_AGENT_URL = process.env.A2A_AGENT_URL || "http://localhost:10002";
const A2UI_EXTENSION_URI = "https://a2ui.org/a2a-extension/a2ui/v0.8";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    // Generate unique IDs — messageId is required by a2a-sdk
    const requestId = `req-${Date.now()}`;
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const rpcPayload = {
      jsonrpc: "2.0",
      id: requestId,
      method: "message/send",
      params: {
        message: {
          messageId,
          role: "user",
          parts: [
            {
              kind: "text",
              text: prompt.trim(),
            },
          ],
          extensions: [A2UI_EXTENSION_URI],
        },
        configuration: {
          acceptedOutputModes: ["text", "application/json+a2ui"],
        },
      },
    };

    const agentResponse = await fetch(A2A_AGENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(rpcPayload),
      signal: AbortSignal.timeout(60_000),
    });

    if (!agentResponse.ok) {
      const errText = await agentResponse.text();
      console.error("A2A agent error:", agentResponse.status, errText);
      return NextResponse.json(
        { error: `Agent returned ${agentResponse.status}` },
        { status: 502 }
      );
    }

    const rpcResult = await agentResponse.json();

    if (rpcResult.error) {
      console.error("JSON-RPC error:", rpcResult.error);
      return NextResponse.json(
        { error: rpcResult.error.message || "Agent error" },
        { status: 500 }
      );
    }

    const a2uiMessages: Record<string, unknown>[] = [];
    let textContent = "";

    const resultData = rpcResult.result;

    const parts =
      resultData?.status?.message?.parts ||
      resultData?.artifact?.parts ||
      resultData?.message?.parts ||
      [];

    for (const part of parts) {
      if (part.kind === "text" || part.text) {
        textContent += part.text || "";
      }
      if (
        part.kind === "data" &&
        part.metadata?.mimeType === "application/json+a2ui" &&
        part.data
      ) {
        a2uiMessages.push(part.data as Record<string, unknown>);
      }
    }

    // Fallback: parse A2UI JSON embedded in text response
    if (a2uiMessages.length === 0 && textContent.includes("---a2ui_JSON---")) {
      const [, jsonPart] = textContent.split("---a2ui_JSON---", 2);
      if (jsonPart?.trim()) {
        try {
          const cleaned = jsonPart
            .trim()
            .replace(/^```json\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed)) {
            a2uiMessages.push(...parsed);
          } else {
            a2uiMessages.push(parsed);
          }
        } catch (e) {
          console.error("Failed to parse A2UI JSON from text:", e);
        }
      }
    }

    return NextResponse.json({
      messages: a2uiMessages,
      text: textContent,
      raw: process.env.NODE_ENV === "development" ? rpcResult : undefined,
    });
  } catch (err) {
    console.error("Generate route error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}