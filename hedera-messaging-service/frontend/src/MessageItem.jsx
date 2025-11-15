import React from "react";

export default function MessageItem({ m = {}, index = 0 }) {
  // Alternate bubble style for variety
  const isLeft = index % 2 === 0;

  const bubbleStyles = isLeft
    ? "bg-white border border-slate-200 text-slate-800"
    : "bg-sky-50 border border-sky-200 text-sky-900";

  const alignment = isLeft ? "self-start text-left" : "self-end text-right";

  // Timestamp rendering
  const timestamp = m.consensusTimestamp
    ? new Date(m.consensusTimestamp).toLocaleString()
    : "pending…";

  return (
    <div className={`flex flex-col max-w-[80%] ${alignment} animate-fadeIn`}>
      <div className={`p-3 rounded-2xl shadow-sm ${bubbleStyles}`}>
        <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>

        {/* Sequence badge */}
        <div className="mt-2 text-[10px] text-slate-500">#{m.seq ?? "—"}</div>

        {/* Failed indicator */}
        {m.failed && (
          <div className="mt-1 text-xs text-rose-600 font-medium">
            Failed to send
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="mt-1 text-xs text-slate-400">{timestamp}</div>
    </div>
  );
}