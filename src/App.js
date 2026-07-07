import { useState, useRef, useEffect } from "react";

const SAMPLE_TRANSCRIPT = `[00:00] Priya: Okay let's get started, thanks everyone for joining. Today's agenda is the Q3 pricing review and the API migration update.
[00:12] Priya: First up, pricing. We've been going back and forth on the enterprise tier for weeks.
[00:20] Rahul: Yeah so I ran the numbers again last night. Option B, the $499 flat tier, comes out ahead on margin by about 12%.
[00:35] Priya: Okay, I think we've debated this enough. Let's go with option B for the enterprise pricing. Final call.
[00:44] Sneha: Sounds good. Honestly relieved we're done with this one, it's been dragging.
[00:50] Priya: Agreed. Rahul, can you send the updated pricing sheet to finance by Friday so they can update the contracts?
[01:02] Rahul: Yep, can do. I'll have it to them by Friday morning.
[01:10] Priya: Perfect. Okay, moving to the API migration.
[01:18] Sneha: So migration is mostly done, we're at like 87% of traffic on v2 now.
[01:28] Sneha: The remaining 13% is mostly the legacy webhook clients, which is going to be annoying.
[01:38] Priya: How annoying are we talking?
[01:42] Sneha: Honestly not sure yet, I haven't dug into it properly.
[01:50] Priya: Okay, can you take a look this week and let us know what the effort looks like?
[02:02] Sneha: Sure, I'll dig into it and report back.
[02:10] Rahul: One thing - are we sunsetting v1 entirely or keeping it around for enterprise clients on old contracts?
[02:22] Priya: Good question, I genuinely don't know. Let's not decide that today, we need legal input first.
[02:34] Sneha: Yeah agreed, that feels like a bigger conversation.
[02:52] Priya: Alright, last thing - just a heads up, I'm out next Monday so Sneha if anything urgent comes up on pricing, you're the point of contact.
[03:05] Sneha: Got it, no problem.
[03:10] Priya: Great, thanks everyone, talk soon.`;

const MOCK_EXTRACTIONS = [
  { id: 1, type: "decision", summary: "Go with option B — $499 flat enterprise pricing tier", confidence: "high", owner: null, deadline: null, time: "00:35" },
  { id: 2, type: "action_item", summary: "Send updated pricing sheet to finance", confidence: "high", owner: "Rahul", deadline: "Friday", time: "00:50" },
  { id: 3, type: "question", summary: "How much effort is the legacy webhook client migration?", confidence: "low", owner: "Sneha", deadline: null, time: "01:42" },
  { id: 4, type: "action_item", summary: "Investigate legacy webhook migration effort and report back", confidence: "high", owner: "Sneha", deadline: "this week", time: "01:50" },
  { id: 5, type: "question", summary: "Should v1 API be sunset entirely or kept for enterprise clients? — deferred, needs legal input", confidence: "medium", owner: null, deadline: null, time: "02:22" },
  { id: 6, type: "decision", summary: "Sneha is point of contact for urgent pricing matters while Priya is out Monday", confidence: "high", owner: "Sneha", deadline: "next Monday", time: "02:52" },
];

const COLORS = {
  action_item: { bg: "#0F2A1A", border: "#1D9E75", text: "#5DCAA5", label: "Action" },
  decision: { bg: "#1A1428", border: "#7F77DD", text: "#AFA9EC", label: "Decision" },
  question: { bg: "#2A1A0F", border: "#BA7517", text: "#EF9F27", label: "Open Q" },
};

const CONFIDENCE_COLORS = {
  high: "#1D9E75",
  medium: "#BA7517",
  low: "#D85A30",
};

export default function MeetingGhostDashboard() {
  const [transcript, setTranscript] = useState("");
  const [lines, setLines] = useState([]);
  const [extractions, setExtractions] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [currentLine, setCurrentLine] = useState(0);
  const [activeTab, setActiveTab] = useState("live");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const feedRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [lines, extractions]);

  const loadSample = () => {
    setTranscript(SAMPLE_TRANSCRIPT);
  };

const startAnalysis = () => {
    if (!transcript.trim()) return;
    setIsRunning(true);
    setIsDone(false);
    setLines([]);
    setExtractions([]);
    setActiveTab("live");

    fetch(`${process.env.REACT_APP_API_URL || "http://localhost:8000"}/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, meeting_title: "Live meeting" }),
    }).then(response => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            setIsRunning(false);
            setIsDone(true);
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop();

          events.forEach(eventBlock => {
            const eventMatch = eventBlock.match(/event: (.+)/);
            const dataMatch = eventBlock.match(/data: (.+)/);
            if (!eventMatch || !dataMatch) return;

            const eventType = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            if (eventType === "line") {
              setLines(prev => [...prev, data.text]);
            } else if (eventType === "extraction") {
              setExtractions(prev => [...prev, { id: prev.length + 1, ...data }]);
            } else if (eventType === "done") {
              setIsRunning(false);
              setIsDone(true);
            }
          });

          read();
        });
      }
      read();
    }).catch(err => {
      console.error("Failed to connect to backend:", err);
      setIsRunning(false);
    });
  };

  const reset = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setIsDone(false);
    setLines([]);
    setExtractions([]);
    setCurrentLine(0);
  };

  const autoTasks = extractions.filter(e => e.type === "action_item" && e.confidence === "high");
  const decisions = extractions.filter(e => e.type === "decision");
  const questions = extractions.filter(e => e.type === "question");

  return (
    <div style={{ background: "#0A0A0B", minHeight: "100vh", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#E2E2E2", padding: "0" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1E1E24", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0D0D10" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isRunning ? "#1D9E75" : isDone ? "#7F77DD" : "#444", boxShadow: isRunning ? "0 0 8px #1D9E75" : "none", transition: "all 0.3s" }} />
          <span style={{ fontSize: "14px", fontWeight: "600", letterSpacing: "0.1em", color: "#E2E2E2" }}>MEETING GHOST</span>
          <span style={{ fontSize: "11px", color: "#555", letterSpacing: "0.05em" }}>real-time meeting intelligence</span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {isDone && (
            <span style={{ fontSize: "11px", background: "#0F2A1A", color: "#5DCAA5", border: "1px solid #1D9E75", padding: "3px 10px", borderRadius: "4px" }}>
              {autoTasks.length} tasks created · {decisions.length} decisions · {questions.length} open questions
            </span>
          )}
          <span style={{ fontSize: "11px", color: "#444" }}>v3.0 + RAG + n8n</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", height: "calc(100vh - 57px)" }}>

        {/* Left panel — input */}
        <div style={{ borderRight: "1px solid #1E1E24", display: "flex", flexDirection: "column", background: "#0D0D10" }}>
          <div style={{ padding: "16px", borderBottom: "1px solid #1E1E24" }}>
            <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "8px" }}>TRANSCRIPT INPUT</div>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Paste your meeting transcript here..."
              style={{ width: "100%", height: "200px", background: "#0A0A0B", border: "1px solid #1E1E24", borderRadius: "4px", color: "#9A9A9A", fontSize: "11px", padding: "10px", resize: "none", fontFamily: "inherit", lineHeight: "1.6", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button onClick={loadSample} style={{ flex: 1, background: "transparent", border: "1px solid #1E1E24", color: "#555", fontSize: "11px", padding: "7px", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit" }}>
                load sample
              </button>
              <button onClick={reset} style={{ background: "transparent", border: "1px solid #1E1E24", color: "#555", fontSize: "11px", padding: "7px 12px", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit" }}>
                clear
              </button>
            </div>
          </div>

          <div style={{ padding: "16px", borderBottom: "1px solid #1E1E24" }}>
            <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "8px" }}>ANTHROPIC API KEY</div>
            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                style={{ width: "100%", background: "#0A0A0B", border: "1px solid #1E1E24", borderRadius: "4px", color: "#9A9A9A", fontSize: "11px", padding: "7px 36px 7px 10px", fontFamily: "inherit", boxSizing: "border-box" }}
              />
              <button onClick={() => setShowKey(!showKey)} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "11px" }}>
                {showKey ? "hide" : "show"}
              </button>
            </div>
          </div>

          <div style={{ padding: "16px" }}>
            <button
              onClick={isRunning ? reset : startAnalysis}
              disabled={!transcript.trim()}
              style={{
                width: "100%", padding: "12px", borderRadius: "4px", fontSize: "12px", fontFamily: "inherit", cursor: transcript.trim() ? "pointer" : "not-allowed", fontWeight: "600", letterSpacing: "0.08em", transition: "all 0.2s",
                background: isRunning ? "#2A0A0A" : "#0F2A1A",
                border: isRunning ? "1px solid #993C1D" : "1px solid #1D9E75",
                color: isRunning ? "#D85A30" : "#5DCAA5",
              }}
            >
              {isRunning ? "◼ STOP ANALYSIS" : "▶ RUN AGENT"}
            </button>
          </div>

          {/* Stack */}
          <div style={{ padding: "0 16px 16px", marginTop: "auto" }}>
            <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "10px" }}>TECH STACK</div>
            {[
              { label: "Claude Sonnet 4.6", desc: "reasoning engine" },
              { label: "ChromaDB", desc: "RAG vector memory" },
              { label: "n8n", desc: "workflow orchestration" },
              { label: "Pydantic v2", desc: "structured output" },
              { label: "Slack API", desc: "live notifications" },
            ].map(t => (
              <div key={t.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #131316" }}>
                <span style={{ fontSize: "11px", color: "#7F77DD" }}>{t.label}</span>
                <span style={{ fontSize: "10px", color: "#444" }}>{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column" }}>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1E1E24", background: "#0D0D10" }}>
            {["live", "summary", "memory"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "12px 20px", background: "none", border: "none", fontSize: "11px", letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit", color: activeTab === tab ? "#E2E2E2" : "#444", borderBottom: activeTab === tab ? "2px solid #7F77DD" : "2px solid transparent", transition: "all 0.2s" }}>
                {tab.toUpperCase()}
                {tab === "live" && extractions.length > 0 && (
                  <span style={{ marginLeft: "6px", background: "#1A1428", color: "#7F77DD", fontSize: "10px", padding: "1px 6px", borderRadius: "10px" }}>{extractions.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Live tab */}
          {activeTab === "live" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflow: "hidden" }}>

              {/* Transcript stream */}
              <div style={{ borderRight: "1px solid #1E1E24", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid #131316", fontSize: "10px", color: "#555", letterSpacing: "0.1em" }}>
                  TRANSCRIPT STREAM {isRunning && <span style={{ color: "#1D9E75" }}>● LIVE</span>}
                </div>
                <div ref={feedRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                  {lines.length === 0 && (
                    <div style={{ color: "#333", fontSize: "12px", marginTop: "40px", textAlign: "center" }}>
                      {transcript ? "press run agent to start" : "load a transcript to begin"}
                    </div>
                  )}
                  {lines.map((line, i) => {
                    const timeMatch = line.match(/\[(\d+:\d+)\]/);
                    const speakerMatch = line.match(/\] ([^:]+):/);
                    const textMatch = line.match(/: (.+)$/);
                    return (
                      <div key={i} style={{ marginBottom: "6px", display: "flex", gap: "8px", opacity: i === lines.length - 1 ? 1 : 0.6 }}>
                        <span style={{ fontSize: "10px", color: "#444", minWidth: "36px" }}>{timeMatch ? timeMatch[1] : ""}</span>
                        <span style={{ fontSize: "11px", color: "#7F77DD", minWidth: "44px" }}>{speakerMatch ? speakerMatch[1] : ""}</span>
                        <span style={{ fontSize: "11px", color: "#9A9A9A", lineHeight: "1.5" }}>{textMatch ? textMatch[1] : line}</span>
                      </div>
                    );
                  })}
                  {isRunning && (
                    <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#1D9E75", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Extractions */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid #131316", fontSize: "10px", color: "#555", letterSpacing: "0.1em" }}>
                  AGENT EXTRACTIONS
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                  {extractions.length === 0 && (
                    <div style={{ color: "#333", fontSize: "12px", marginTop: "40px", textAlign: "center" }}>
                      extractions appear here as the agent processes
                    </div>
                  )}
                  {extractions.map((item, i) => {
                    const c = COLORS[item.type];
                    return (
                      <div key={item.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "4px", padding: "10px 12px", marginBottom: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "10px", color: c.text, letterSpacing: "0.08em", fontWeight: "600" }}>{c.label}</span>
                          <span style={{ fontSize: "10px", color: CONFIDENCE_COLORS[item.confidence] }}>{item.confidence}</span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#C8C8C8", lineHeight: "1.5", marginBottom: "6px" }}>{item.summary}</div>
                        <div style={{ display: "flex", gap: "12px" }}>
                          {item.owner && <span style={{ fontSize: "10px", color: "#555" }}>owner: <span style={{ color: "#9A9A9A" }}>{item.owner}</span></span>}
                          {item.deadline && <span style={{ fontSize: "10px", color: "#555" }}>due: <span style={{ color: "#9A9A9A" }}>{item.deadline}</span></span>}
                        </div>
                        {item.confidence === "high" && item.type === "action_item" && (
                          <div style={{ marginTop: "6px", fontSize: "10px", color: "#1D9E75" }}>↗ auto-created in Notion via n8n</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Summary tab */}
          {activeTab === "summary" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {!isDone ? (
                <div style={{ color: "#333", fontSize: "12px", marginTop: "60px", textAlign: "center" }}>run the agent to see the meeting summary</div>
              ) : (
                <>
                  <div style={{ marginBottom: "24px" }}>
                    <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "12px" }}>DECISIONS MADE</div>
                    {decisions.map(d => (
                      <div key={d.id} style={{ background: "#1A1428", border: "1px solid #534AB7", borderRadius: "4px", padding: "10px 14px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#C8C8C8" }}>{d.summary}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: "24px" }}>
                    <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "12px" }}>TASKS AUTO-CREATED</div>
                    {autoTasks.map(t => (
                      <div key={t.id} style={{ background: "#0F2A1A", border: "1px solid #1D9E75", borderRadius: "4px", padding: "10px 14px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "#C8C8C8", marginBottom: "4px" }}>{t.summary}</div>
                          <div style={{ fontSize: "10px", color: "#555" }}>{t.owner} · due {t.deadline}</div>
                        </div>
                        <span style={{ fontSize: "10px", color: "#1D9E75", whiteSpace: "nowrap", marginLeft: "12px" }}>✓ Notion</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "12px" }}>OPEN QUESTIONS</div>
                    {questions.map(q => (
                      <div key={q.id} style={{ background: "#2A1A0F", border: "1px solid #854F0B", borderRadius: "4px", padding: "10px 14px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#C8C8C8" }}>{q.summary}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Memory tab */}
          {activeTab === "memory" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "16px" }}>CHROMADB — CROSS-MEETING MEMORY</div>
              {[
                { date: "2026-06-10", title: "Sprint planning", items: 4, recurring: false },
                { date: "2026-06-03", title: "Q3 pricing review", items: 6, recurring: true },
                { date: "2026-05-27", title: "API migration sync", items: 3, recurring: false },
              ].map(m => (
                <div key={m.date} style={{ background: "#0D0D10", border: "1px solid #1E1E24", borderRadius: "4px", padding: "12px 16px", marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#C8C8C8" }}>{m.title}</span>
                    <span style={{ fontSize: "10px", color: "#444" }}>{m.date}</span>
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", color: "#555" }}>{m.items} items stored</span>
                    {m.recurring && <span style={{ fontSize: "10px", color: "#BA7517" }}>⚠ recurring topic detected</span>}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: "16px", padding: "12px 16px", background: "#0A0A0B", border: "1px solid #131316", borderRadius: "4px" }}>
                <div style={{ fontSize: "10px", color: "#555", marginBottom: "6px" }}>VECTOR DB STATS</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  {[["13", "items stored"], ["0.82", "similarity threshold"], ["3", "meetings indexed"]].map(([val, label]) => (
                    <div key={label}>
                      <div style={{ fontSize: "18px", color: "#7F77DD", fontWeight: "600" }}>{val}</div>
                      <div style={{ fontSize: "10px", color: "#444" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0A0A0B; }
        ::-webkit-scrollbar-thumb { background: #1E1E24; border-radius: 2px; }
        textarea:focus, input:focus { outline: 1px solid #534AB7; }
        button:hover { opacity: 0.8; }
      `}</style>
    </div>
  );
}
