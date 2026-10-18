"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Download, Loader2, Maximize2, Minimize2, RotateCcw, Send, Sparkles, X } from "lucide-react";

import { apiRequest } from "@/lib/api/client";

import "./AssistantPanel.css";

const STORAGE_KEY = "erp-assistant-v2";
const EXAMPLES = [
  "New order for Ali Traders: 5000 #5 brass sliders at Rs 12, delivery on the 30th",
  "Paid the electricity bill of Rs 18,500 in cash today",
  "New supplier: Star Metals, Lahore, 0300-1234567",
  "Casual leave for Bilal for 2 days from tomorrow",
  "Show this month's deliveries",
  "Which invoices are overdue?",
  "Raise a requisition for everything MRP says we must buy",
];

/* Thousands separators on exact decimal strings (no float rounding). */
function formatCell(value, type) {
  if (value === null || value === undefined || value === "") return "";
  const textValue = String(value);
  if ((type === "number" || type === "money") && /^-?\d+(\.\d+)?$/.test(textValue)) {
    const [whole, fraction] = textValue.split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fraction ? `${grouped}.${type === "money" ? fraction.padEnd(2, "0").slice(0, 2) : fraction}` : type === "money" ? `${grouped}.00` : grouped;
  }
  if (type === "percent" && /^-?\d+(\.\d+)?$/.test(textValue)) return `${textValue}%`;
  if (type === "datetime") return textValue.slice(0, 16).replace("T", " ");
  return textValue;
}

function ReportTableView({ table }) {
  const numeric = (type) => type === "number" || type === "money" || type === "percent";
  const hasTotals = Object.keys(table.totals ?? {}).length > 0 && table.rows.length > 0;
  return (
    <div className="ai-table">
      <div className="ai-table__head">
        <div>
          <strong>{table.title}</strong>
          <small>{table.from ? `${table.from} to ${table.to} · ` : ""}{table.totalRows} row{table.totalRows === 1 ? "" : "s"}{table.truncated ? ` (first ${table.rows.length} shown)` : ""}</small>
        </div>
        <a className="ai-btn" href={table.csvPath}><Download size={14} /> CSV</a>
      </div>
      {table.rows.length === 0 ? (
        <p className="ai-card__note">No rows for this period.</p>
      ) : (
        <div className="ai-table__scroll">
          <table>
            <thead>
              <tr>{table.columns.map((column) => <th key={column.key} className={numeric(column.type) ? "is-num" : ""}>{column.label}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>{table.columns.map((column) => <td key={column.key} className={numeric(column.type) ? "is-num" : ""}>{formatCell(row[column.key], column.type)}</td>)}</tr>
              ))}
            </tbody>
            {hasTotals && (
              <tfoot>
                <tr>{table.columns.map((column, index) => <td key={column.key} className={numeric(column.type) ? "is-num" : ""}>{table.totals[column.key] !== undefined ? formatCell(table.totals[column.key], column.type) : index === 0 ? (table.truncated ? `Total (all ${table.totalRows})` : "Total") : ""}</td>)}</tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

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
  const [wide, setWide] = useState(false);
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

  const canPrepare = setup?.tools?.some((name) => name.startsWith("propose_") || name === "show_report");
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
      setChat((items) => [...items, { role: "assistant", text: turn.reply, proposals: turn.proposals, tables: turn.tables }]);
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

  async function confirmAll(proposals) {
    for (const proposal of proposals) {
      const status = cards[proposal.id]?.status;
      if (!status || status === "failed") await confirm(proposal);
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
      <button type="button" className={`ai-launcher${open ? " ai-launcher--hidden" : ""}`} onClick={() => setOpen(true)} aria-label="Open the AI assistant">
        <Sparkles size={18} />
        <span>AI assistant</span>
      </button>

      {open && (
        <aside className={`ai-panel${wide ? " ai-panel--wide" : ""}`} role="dialog" aria-label="AI assistant">
          <header className="ai-panel__head">
            <div>
              <strong><Sparkles size={15} /> AI assistant</strong>
              <small>Tell me what happened or what you need to see. I prepare entries and reports; you confirm.</small>
            </div>
            <div className="ai-panel__tools">
              <button type="button" className="ai-icon" onClick={() => setWide((value) => !value)} aria-label={wide ? "Narrow panel" : "Widen panel"} title={wide ? "Narrow panel" : "Widen panel"}>{wide ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
              <button type="button" className="ai-icon" onClick={reset} aria-label="New conversation" title="New conversation"><RotateCcw size={15} /></button>
              <button type="button" className="ai-icon" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
          </header>

          <div className="ai-panel__list" ref={listRef}>
            {!setup.configured && (
              <p className="ai-notice">The assistant is not set up yet. An administrator must add <code>GROQ_API_KEY</code> (or <code>XAI_API_KEY</code>) to the server environment.</p>
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
                {item.tables?.map((table) => <ReportTableView key={table.id} table={table} />)}
                {item.proposals?.filter((proposal) => !cards[proposal.id] || cards[proposal.id].status === "failed").length > 1 && (
                  <button type="button" className="ai-btn ai-btn--primary ai-confirm-all" onClick={() => confirmAll(item.proposals)}>
                    <CheckCheck size={14} /> Confirm all {item.proposals.filter((proposal) => !cards[proposal.id] || cards[proposal.id].status === "failed").length}
                  </button>
                )}
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
              placeholder="Type, for example: Show this month's deliveries…"
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
