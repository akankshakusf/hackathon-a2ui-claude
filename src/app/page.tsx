"use client";

import { useState, useRef, useEffect } from "react";

type AppState = "idle" | "thinking" | "rendered" | "error";

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

const PROMPTS = [
  "Build a contact form with name, email, and message",
  "Create a dashboard with 3 KPI stat cards",
  "Make a team member profile card for Sarah Chen, Lead Designer",
  "Generate a todo list for launching a product",
  "Design a booking confirmation for a flight to Tokyo",
  "Create a feedback survey with star ratings",
  "Build a settings panel with toggles and dropdowns",
  "Make a job application form",
];

function ThinkingDots() {
  return (
    <div className="thinking">
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
    </div>
  );
}

function A2UIRenderer({ messages }: { messages: Record<string, unknown>[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || messages.length === 0) return;

    const init = async () => {
      try {
        await import("@a2ui/lit");
        const { Data } = await import("@a2ui/lit/0.8");
        const { ContextProvider, createContext } = await import("@lit/context");
        const themeContext = createContext("A2UITheme");

        if (!containerRef.current) return;
        containerRef.current.innerHTML = "";

        const beginMsg = messages.find((m) => "beginRendering" in m) as any;
        if (!beginMsg?.beginRendering) return;
        const { surfaceId } = beginMsg.beginRendering;

        const theme = {
          components: {
            Text: { all: {}, h1: {}, h2: {}, h3: {}, h4: {}, h5: {}, caption: {}, body: {} },
            Button: {},
            TextField: { container: {}, label: {}, element: {} },
            Icon: {},
            Card: {},
            Row: {},
            Column: {},
            List: {},
            Divider: {},
            CheckBox: {},
            Slider: {},
            MultipleChoice: {},
            DateTimeInput: {},
            Tabs: {},
            Modal: {},
          },
          markdown: {},
          additionalStyles: {},
        };

        const processor = new Data.A2uiMessageProcessor();
        processor.processMessages(messages);
        const surface = processor.getSurfaces().get(surfaceId);
        if (!surface) { console.error("[A2UI] No surface for id:", surfaceId); return; }

        const wrapper = document.createElement("div");
        wrapper.style.cssText = "width:100%;";
        containerRef.current.appendChild(wrapper);

        new ContextProvider(wrapper, { context: themeContext, initialValue: theme });

        const el = document.createElement("a2ui-surface") as any;
        el.style.cssText = "width:100%; display:block;";
        wrapper.appendChild(el);

        await customElements.whenDefined("a2ui-surface");
        await new Promise(r => setTimeout(r, 150));

        el.surfaceId = surfaceId;
        el.processor = processor;
        el.surface = surface;

        console.log("[A2UI] Rendered successfully");
      } catch (e) {
        console.error("[A2UI] Render error:", e);
      }
    };

    init();
  }, [mounted, messages]);

  if (!mounted) return null;
  return (
    <div
      ref={containerRef}
      style={{ width: "100%", minHeight: "300px", background: "#fff", borderRadius: "12px", padding: "24px", color: "#111" }}
    />
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<AppState>("idle");
  const [a2uiMessages, setA2uiMessages] = useState<Record<string, unknown>[]>([]);
  const [lastPrompt, setLastPrompt] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [history, setHistory] = useState<HistoryTurn[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const refineRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PROMPTS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const submit = async (prompt: string, isRefinement = false) => {
    const trimmed = prompt.trim();
    if (!trimmed || state === "thinking") return;

    setLastPrompt(trimmed);
    setInput("");
    setState("thinking");
    setErrorMsg("");

    if (!isRefinement) {
      setA2uiMessages([]);
      setHistory([]);
    }

    const historyToSend = isRefinement ? history : [];

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, history: historyToSend }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.messages || data.messages.length === 0)
        throw new Error("Claude generated no UI — try rephrasing");

      setA2uiMessages(data.messages);
      setState("rendered");

      // Build assistant content for history — includes the full A2UI JSON so Claude
      // knows exactly what it generated for follow-up refinements
      const assistantContent = data.text
        ? `${data.text}\n---a2ui_JSON---\n${JSON.stringify(data.messages)}`
        : JSON.stringify(data.messages);

      setHistory([
        ...historyToSend,
        { role: "user", content: trimmed },
        { role: "assistant", content: assistantContent },
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  };

  const reset = () => {
    setState("idle");
    setA2uiMessages([]);
    setInput("");
    setErrorMsg("");
    setHistory([]);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #08080f; --surface: #10101a; --surface2: #171724;
          --border: rgba(255,255,255,0.07); --border-hi: rgba(124,58,237,0.55);
          --accent: #7c3aed; --accent-soft: #a78bfa; --accent2: #06b6d4;
          --glow: rgba(124,58,237,0.22); --text: #eeecff;
          --muted: #6b6b88; --dim: #2e2e42;
          --mono: 'DM Mono', monospace; --display: 'Syne', sans-serif; --r: 14px;
        }
        body { background: var(--bg); color: var(--text); font-family: var(--display); min-height: 100vh; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        body::before { content: ''; position: fixed; inset: 0; background-image: linear-gradient(rgba(124,58,237,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.035) 1px, transparent 1px); background-size: 44px 44px; pointer-events: none; z-index: 0; }
        .orb { position: fixed; border-radius: 50%; filter: blur(130px); pointer-events: none; z-index: 0; }
        .orb1 { width: 700px; height: 700px; background: radial-gradient(circle, rgba(124,58,237,0.13), transparent 70%); top: -250px; left: -250px; }
        .orb2 { width: 550px; height: 550px; background: radial-gradient(circle, rgba(6,182,212,0.08), transparent 70%); bottom: -180px; right: -180px; }
        .app { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }
        .hdr { padding: 18px 32px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); backdrop-filter: blur(10px); }
        .logo { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; letter-spacing: -0.025em; }
        .pulse { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 14px var(--accent); animation: pulse 2.2s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }
        .chip-badge { font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 5px; background: rgba(124,58,237,0.14); border: 1px solid rgba(124,58,237,0.3); color: var(--accent-soft); }
        .idle { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 48px 24px; gap: 52px; }
        .hero { text-align:center; max-width: 660px; }
        .eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent2); margin-bottom: 18px; }
        h1 { font-size: clamp(38px, 6.5vw, 68px); font-weight: 800; line-height: 1.04; letter-spacing: -0.045em; margin-bottom: 18px; }
        h1 span { background: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .sub { font-size: 16px; color: var(--muted); line-height: 1.65; font-weight: 400; }
        .iz { width:100%; max-width: 700px; display:flex; flex-direction:column; gap:14px; }
        .iw { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); transition: border-color 0.2s, box-shadow 0.2s; }
        .iw:focus-within { border-color: var(--border-hi); box-shadow: 0 0 0 3px var(--glow), 0 12px 40px rgba(0,0,0,0.5); }
        .iw textarea { width:100%; background:transparent; border:none; outline:none; resize:none; color: var(--text); font-family: var(--display); font-size: 16px; line-height: 1.55; padding: 20px 130px 20px 22px; min-height: 68px; max-height: 180px; }
        .iw textarea::placeholder { color: var(--dim); }
        .ia { position:absolute; right:14px; bottom:14px; display:flex; align-items:center; gap:10px; }
        .kh { font-family: var(--mono); font-size: 10px; color: var(--dim); }
        .go { background: linear-gradient(135deg, var(--accent), #6d28d9); color: #fff; border:none; border-radius:9px; width:38px; height:38px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:17px; transition: opacity 0.15s, transform 0.15s; flex-shrink:0; }
        .go:hover:not(:disabled) { opacity:0.85; transform:scale(1.06); }
        .go:disabled { opacity:0.25; cursor:not-allowed; }
        .chips { display:flex; flex-wrap:wrap; gap:8px; }
        .chip { font-family: var(--mono); font-size: 11px; padding: 6px 13px; border-radius: 7px; background: var(--surface2); border: 1px solid var(--border); color: var(--muted); cursor:pointer; transition: all 0.15s; white-space: nowrap; }
        .chip:hover { border-color: rgba(124,58,237,0.45); color: var(--text); background: rgba(124,58,237,0.09); }
        .thinking-scr { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; }
        .thinking { display:flex; gap:7px; align-items:center; }
        .dot { width:9px; height:9px; border-radius:50%; background: var(--accent); animation: bop 1.4s ease-in-out infinite; }
        .dot:nth-child(2) { animation-delay:0.2s; background: var(--accent-soft); }
        .dot:nth-child(3) { animation-delay:0.4s; background: var(--accent2); }
        @keyframes bop { 0%,80%,100% { transform:translateY(0); opacity:0.35; } 40% { transform:translateY(-11px); opacity:1; } }
        .thlabel { font-family: var(--mono); font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color: var(--accent); }
        .thprompt { font-family: var(--mono); font-size:13px; color: var(--muted); max-width:500px; text-align:center; padding:0 24px; line-height:1.5; }
        .thprompt em { color: var(--text); font-style:normal; }
        .rendered { flex:1; display:flex; flex-direction:column; overflow:hidden; }
        .rh { padding: 12px 24px; display:flex; align-items:center; gap:12px; border-bottom: 1px solid var(--border); flex-shrink:0; }
        .rl { font-family:var(--mono); font-size:10px; color:var(--dim); letter-spacing:0.06em; }
        .rp { font-size:13px; color:var(--muted); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ras { display:flex; gap:8px; align-items:center; }
        .ab { font-family:var(--mono); font-size:11px; padding:5px 13px; border-radius:7px; border:1px solid var(--border); background:var(--surface); color: var(--muted); cursor:pointer; transition:all 0.15s; white-space:nowrap; }
        .ab:hover { border-color: rgba(124,58,237,0.4); color:var(--text); }
        .ab.p { background: rgba(124,58,237,0.15); border-color:rgba(124,58,237,0.4); color: var(--accent-soft); }
        .ab.p:hover { background: rgba(124,58,237,0.25); }
        .history-badge { font-family:var(--mono); font-size:10px; color:var(--accent-soft); padding:2px 8px; border-radius:4px; background:rgba(124,58,237,0.1); border:1px solid rgba(124,58,237,0.2); }
        .canvas { flex:1; overflow-y:auto; display:flex; align-items:flex-start; justify-content:center; padding: 52px 24px; }
        .ci { width:100%; max-width:700px; animation: fadeUp 0.4s ease; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        .refbar { border-top: 1px solid var(--border); padding:16px 24px; display:flex; gap:10px; align-items:center; flex-shrink:0; }
        .ri { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:9px; color:var(--text); font-family:var(--display); font-size:14px; padding:10px 16px; outline:none; transition: border-color 0.2s; }
        .ri:focus { border-color: var(--border-hi); }
        .ri::placeholder { color: var(--dim); }
        .err { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:40px; text-align:center; }
        .err-icon { font-size:42px; }
        .err-title { font-size:20px; font-weight:700; }
        .err-msg { font-family:var(--mono); font-size:12px; color:var(--muted); max-width:420px; line-height:1.5; }
      `}</style>

      <div className="orb orb1" />
      <div className="orb orb2" />

      <div className="app">
        <header className="hdr">
          <div className="logo">
            <div className="pulse" />
            <span>Morphic UI</span>
          </div>
          <span className="chip-badge">Claude · A2UI · A2A</span>
        </header>

        {state === "idle" && (
          <main className="idle">
            <div className="hero">
              <p className="eyebrow">Agent-Driven Generative Interface</p>
              <h1>Describe it.<br /><span>Claude builds it.</span></h1>
              <p className="sub">
                Type any interface you need — a form, a dashboard, a card, a list.
                Claude reasons about your intent and assembles a live, interactive UI.
              </p>
            </div>
            <div className="iz">
              <div className="iw">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit(input, false);
                    }
                  }}
                  placeholder={PROMPTS[placeholderIdx]}
                  rows={2}
                  autoFocus
                />
                <div className="ia">
                  <span className="kh">↵ enter</span>
                  <button className="go" onClick={() => submit(input, false)} disabled={!input.trim()}>→</button>
                </div>
              </div>
              <div className="chips">
                {PROMPTS.slice(0, 5).map((p) => (
                  <button key={p} className="chip" onClick={() => submit(p, false)}>{p}</button>
                ))}
              </div>
            </div>
          </main>
        )}

        {state === "thinking" && (
          <div className="thinking-scr">
            <ThinkingDots />
            <div className="thlabel">Claude is composing your UI</div>
            <p className="thprompt">"<em>{lastPrompt}</em>"</p>
          </div>
        )}

        {state === "rendered" && (
          <div className="rendered">
            <div className="rh">
              <span className="rl">PROMPT</span>
              <span className="rp">{lastPrompt}</span>
              <div className="ras">
                {history.length > 2 && (
                  <span className="history-badge">{Math.floor(history.length / 2)} refinement{history.length > 4 ? "s" : ""}</span>
                )}
                <button className="ab p" onClick={() => refineRef.current?.focus()}>Refine ↑</button>
                <button className="ab" onClick={reset}>New UI</button>
              </div>
            </div>
            <div className="canvas">
              <div className="ci">
                <A2UIRenderer messages={a2uiMessages} />
              </div>
            </div>
            <div className="refbar">
              <input
                ref={refineRef}
                className="ri"
                placeholder="Refine — e.g. 'add a phone field' or 'make it dark mode'"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value;
                    if (val.trim()) {
                      submit(val, true);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
              <button className="ab p" onClick={() => {
                if (refineRef.current?.value.trim()) {
                  submit(refineRef.current.value, true);
                  refineRef.current.value = "";
                }
              }}>→</button>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="err">
            <div className="err-icon">⚠</div>
            <div className="err-title">Generation failed</div>
            <p className="err-msg">{errorMsg}</p>
            <button className="ab p" onClick={reset}>Try again</button>
          </div>
        )}
      </div>
    </>
  );
}
