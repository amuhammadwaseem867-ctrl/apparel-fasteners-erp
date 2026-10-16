"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";

import { apiRequest } from "@/lib/api/client";

import "./AssistantPanel.css";

const STORAGE_KEY = "erp-assistant-v1";
const EXAMPLES = [
  "New order for Ali Traders: 5000 #5 brass sliders at Rs 12, delivery on the 30th",
  "Paid the electricity bill of Rs 18,500 in cash today",
  "New supplier: Star Metals, Lahore, 0300-1234567",
  "Casual leave for Bilal for 2 days from tomorrow",
];

const localToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function readSaved() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && Array.isArray(saved.history) && Array.isArray(saved.chat)) return saved;
  } catch {
    // Storage blocked or corrupt: start a fresh conversation.
  }
  return null;
}

function ProposalCard({ proposal, state, onConfirm, onDiscard }) {
  const status = state?.status ?? "pending";
  return (
    <div className={`ai-card ai-card--${status}`}>
      <strong className="ai-card__title">{proposal.title}</strong>
      <dl className="ai-card__rows">
        {proposal.summary.map(([label, value], index) => (
          <div key={`${label}-${index}`}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {status === "saved" && (
        <p className="ai-card__note ai-card__note--ok">
          <Check size={14} /> Saved. <Link href={proposal.openPath}>Open</Link>
        </p>
      )}
      {status === "discarded" && <p className="ai-card__note">Discarded.</p>}
      {status === "failed" && <p className="ai-card__note ai-card__note--error">{state.error}</p>}
      {(status === "pending" || status === "failed" || status === "saving") && (
        <div className="ai-card__actions">
          <button type="button" className="ai-btn ai-btn--primary" disabled={status === "saving"} onClick={onConfirm}>
            {status === "saving" ? <Loader2 size={14} className="ai-spin" /> : <Check size={14} />}
            Confirm &amp; save
          </button>
          <button type="button" className="ai-btn" disabled={status === "saving"} onClick={onDiscard}>Discard</button>
        </div>
      )}
    </div>
  );
}

export default function AssistantPanel() {
  const [setup, setSetup] = useState(null);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [chat, setChat] = useState([]);
  const [cards, setCards] = useState({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loaded = useRef(false);
  const listRef = useRef(null);

  useEffect(() => {
    let alive = true;
    apiRequest("/api/assistant").then((data) => alive && setSetup(data)).catch(() => alive && setSetup({ tools: [] }));
    if (!loaded.current) {
      const saved = readSaved();
      if (saved) {
        setHistory(saved.history);
        setChat(saved.chat);
        setCards(saved.cards ?? {});
      }
      loaded.current = true;
    }
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Not before the saved conversation has been read, or the empty first render would overwrite it.
    if (!loaded.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ history, chat, cards }));
    } catch {
      // Storage full or blocked: the conversation simply is not kept across reloads.
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [history, chat, cards]);

  const canPrepare = setup?.tools?.some((name) => name.startsWith("propose_"));
  if (!setup || !canPrepare) return null;

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    setError("");
    setChat((items) => [...items, { role: "user", text: message }]);
    setBusy(true);
    try {
      const turn = await apiRequest("/api/assistant", { method: "POST", body: JSON.stringify({ message, history, today: localToday() }) });
      setHistory(turn.messages);
      setChat((items) => [...items, { role: "assistant", text: turn.reply, proposals: turn.proposals }]);
    } catch (cause) {
      setError(cause.message);
      setChat((items) => items.slice(0, -1));
      setDraft(message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(proposal) {
    setCards((all) => ({ ...all, [proposal.id]: { status: "saving" } }));
    try {
      await apiRequest(proposal.endpoint, { method: proposal.method, body: JSON.stringify(proposal.body) });
      setCards((all) => ({ ...all, [proposal.id]: { status: "saved" } }));
    } catch (cause) {
      setCards((all) => ({ ...all, [proposal.id]: { status: "failed", error: cause.message } }));
    }
  }

  function reset() {
    setHistory([]);
    setChat([]);
    setCards({});
    setError("");
  }

  return (
    <>
      <button type="button" className={`ai-launcher${open ? " ai-launcher--hidden" : ""}`} onClick={() => setOpen(true)} aria-label="Open the AI entry assistant">
        <Sparkles size={18} />
        <span>AI entry</span>
      </button>

      {open && (
        <aside className="ai-panel" role="dialog" aria-label="AI entry assistant">
          <header className="ai-panel__head">
            <div>
              <strong><Sparkles size={15} /> AI entry assistant</strong>
              <small>Tell me what happened; I prepare the entry and you confirm it.</small>
            </div>
            <div className="ai-panel__tools">
              <button type="button" className="ai-icon" onClick={reset} aria-label="New conversation" title="New conversation"><RotateCcw size={15} /></button>
              <button type="button" className="ai-icon" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
          </header>

          <div className="ai-panel__list" ref={listRef}>
            {!setup.configured && (
              <p className="ai-notice">The assistant is not set up yet. An administrator must add <code>ANTHROPIC_API_KEY</code> to the server environment.</p>
            )}
            {chat.length === 0 && setup.configured && (
              <div className="ai-examples">
                <p>For example:</p>
                {EXAMPLES.map((example) => (
                  <button type="button" key={example} onClick={() => send(example)}>{example}</button>
                ))}
              </div>
            )}
            {chat.map((item, index) => (
              <div key={index} className={`ai-msg ai-msg--${item.role}`}>
                {item.text && <p>{item.text}</p>}
                {item.proposals?.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    state={cards[proposal.id]}
                    onConfirm={() => confirm(proposal)}
                    onDiscard={() => setCards((all) => ({ ...all, [proposal.id]: { status: "discarded" } }))}
                  />
                ))}
              </div>
            ))}
            {busy && <div className="ai-msg ai-msg--assistant ai-msg--typing"><Loader2 size={15} className="ai-spin" /> Working on it…</div>}
            {error && <p className="ai-notice ai-notice--error">{error}</p>}
          </div>

          <form
            className="ai-panel__input"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <textarea
              value={draft}
              rows={2}
              placeholder="Type, for example: New order for Ali Traders, 5000 sliders…"
              disabled={!setup.configured || busy}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(draft);
                }
              }}
            />
            <button type="submit" className="ai-send" disabled={!setup.configured || busy || !draft.trim()} aria-label="Send"><Send size={16} /></button>
          </form>
          <p className="ai-panel__foot">Nothing is saved until you press Confirm.</p>
        </aside>
      )}
    </>
  );
}
