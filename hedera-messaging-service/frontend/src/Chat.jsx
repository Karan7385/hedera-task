import React, { useEffect, useState, useRef } from 'react';
import MessageItem from './MessageItem';
import { getInfo, sendMessage } from './api';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [encrypt, setEncrypt] = useState(true);
  const [filter, setFilter] = useState('');
  const [topicId, setTopicId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const wsRef = useRef(null);
  const messagesRef = useRef(null);

  // fetch topic info
  useEffect(() => {
    getInfo().then(info => setTopicId(info.topicId));
  }, []);

  // websocket connection and incoming messages
  useEffect(() => {
    const wsUrl = (import.meta.env.VITE_BACKEND_WS || 'ws://localhost:4000') + '/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = ev => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'message') {
          setMessages(prev => {
            // avoid duplicates by using sequence (if available)
            const exists = prev.some(m => m.seq === data.seq && m.consensusTimestamp === data.consensusTimestamp);
            return exists ? prev : [...prev, data];
          });
        }
      } catch (err) {
        // ignore malformed
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // auto-scroll on new message
  useEffect(() => {
    if (!messagesRef.current) return;
    const el = messagesRef.current;
    // smooth scroll to bottom
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const payload = {
      // optimistic message object while waiting for mirror node confirmation
      temp: true,
      text,
      consensusTimestamp: new Date().toISOString(),
      seq: `temp-${Date.now()}`
    };
    setMessages(prev => [...prev, payload]);
    setText('');

    try {
      await sendMessage(text, encrypt);
      // server mirror subscription will eventually push the canonical message;
      // keep optimistic message until then (we do not remove here to keep UI simple)
    } catch (err) {
      // indicate failure on last optimistic message
      setMessages(prev => prev.map(m => (m.temp ? { ...m, failed: true } : m)));
      console.error('send failed', err);
    } finally {
      setSending(false);
    }
  };

  // send on Ctrl+Enter
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend();
  };

  // filtered view
  const visible = messages.filter(m =>
    !filter ? true : (m.text || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 p-4">
      <div className="w-full max-w-4xl bg-white shadow-lg rounded-2xl overflow-hidden grid grid-rows-[auto_1fr_auto]">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Hedera HCS Chat</h1>
            <p className="text-sm text-slate-500">Realtime messages via Hedera Consensus Service</p>
          </div>

          <div className="flex items-center gap-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {connected ? 'Connected' : 'Disconnected'}
            </div>

            <div className="text-sm text-slate-600 px-3 py-1 rounded-lg bg-slate-50">
              Topic: <span className="font-mono ml-2 text-slate-800">{topicId || 'loading...'}</span>
            </div>
          </div>
        </header>

        {/* Body */}
        <main className="p-4">
          {/* Controls row */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={encrypt}
                  onChange={e => setEncrypt(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                />
                Encrypt messages
              </label>
              <div className="text-xs text-slate-500">(AES-GCM symmetric — key stored on server for demo)</div>
            </div>

            <div className="flex items-center gap-2">
              <input
                className="px-3 py-2 rounded-lg border border-slate-200 shadow-sm focus:ring-2 focus:ring-sky-200 focus:outline-none text-sm w-64"
                placeholder="Filter messages (keyword)"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <button
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm"
                onClick={() => setFilter('')}
                title="Clear filter"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            ref={messagesRef}
            className="messages-list h-[54vh] md:h-[58vh] overflow-auto rounded-lg border border-slate-100 p-4 bg-gradient-to-b from-white to-slate-50"
          >
            {visible.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                No messages yet — send the first one ✨
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {visible.map((m, i) => (
                  <MessageItem key={m.seq ?? i} m={m} index={i} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Footer / send box */}
        <footer className="p-4 border-t">
          <form onSubmit={handleSend} className="flex gap-3 items-center">
            <div className="flex-1">
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={encrypt ? "Type your message (encrypted)..." : "Type your message (plain)..."}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 text-sm"
              />
              <div className="text-xs text-slate-400 mt-1">Send: <span className="font-mono">Enter</span> • Send & new line: <span className="font-mono">Ctrl/Cmd + Enter</span></div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setText(''); }}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50"
                title="Clear"
              >
                Clear
              </button>

              <button
                type="submit"
                disabled={sending || !text.trim()}
                className={`px-5 py-3 rounded-xl text-white font-semibold transition ${sending ? 'bg-sky-300 cursor-wait' : 'bg-sky-600 hover:bg-sky-700'}`}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </footer>
      </div>
    </div>
  );
}
