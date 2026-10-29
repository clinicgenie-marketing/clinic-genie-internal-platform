"use client";

import { useState, type ReactNode } from "react";

const tabs = [
  { id: "content", label: "Content and settings" },
  { id: "review", label: "Review" },
  { id: "history", label: "History" },
] as const;

export function ArticleTabs({ editor, review, history }: { editor: ReactNode; review: ReactNode; history: ReactNode }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("content");
  const panels = { content: editor, review, history };
  return (
    <div>
      <div role="tablist" aria-label="Article workspace" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={`min-h-11 rounded-full px-4 text-sm font-medium ${tab === item.id ? "bg-action text-white" : "border border-line"}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {tabs.map((item) => (
        <div key={item.id} role="tabpanel" hidden={tab !== item.id}>{panels[item.id]}</div>
      ))}
    </div>
  );
}
