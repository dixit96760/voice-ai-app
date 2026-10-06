"use client";

import React, { useState } from "react";
import { Bot, User, Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TranscriptTurn {
  role: string;
  en_text: string;
  indic_text?: string;
  start_timestamp?: number;
  end_timestamp?: number;
}

interface BilingualTranscriptViewerProps {
  transcriptText: string;
  transcriptJson?: TranscriptTurn[];
  language?: string | null;
}

export function BilingualTranscriptViewer({
  transcriptText,
  transcriptJson = [],
  language,
}: BilingualTranscriptViewerProps) {
  const [viewMode, setViewMode] = useState<"bilingual" | "english" | "indic">("bilingual");

  const formatTimestamp = (ms?: number) => {
    if (ms === undefined || ms === null) return "";
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const hasStructuredTurns = transcriptJson && transcriptJson.length > 0;

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Call Conversation Transcript</h3>
          {language && (
            <Badge variant="outline" className="text-[10px]">
              {language}
            </Badge>
          )}
        </div>

        {hasStructuredTurns && (
          <div className="flex items-center rounded border bg-muted/40 p-0.5 text-xs">
            <button
              onClick={() => setViewMode("bilingual")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === "bilingual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bilingual
            </button>
            <button
              onClick={() => setViewMode("english")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === "english"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setViewMode("indic")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === "indic"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Indic Script
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
        {hasStructuredTurns ? (
          transcriptJson.map((turn, idx) => {
            const isAgent = turn.role === "agent";
            return (
              <div
                key={idx}
                className={`flex items-start gap-2.5 ${isAgent ? "flex-row" : "flex-row-reverse"}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                    isAgent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>

                <div
                  className={`max-w-[80%] rounded-lg p-3 text-xs space-y-1 ${
                    isAgent
                      ? "bg-muted/40 border text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] opacity-75">
                    <span className="font-semibold">{isAgent ? "Sarvam Voice AI" : "Customer"}</span>
                    {turn.start_timestamp !== undefined && (
                      <span className="font-mono">{formatTimestamp(turn.start_timestamp)}</span>
                    )}
                  </div>

                  {viewMode === "bilingual" && (
                    <>
                      {turn.indic_text && turn.indic_text !== turn.en_text && (
                        <p className="font-medium">{turn.indic_text}</p>
                      )}
                      <p className={turn.indic_text ? "opacity-80 italic" : ""}>{turn.en_text}</p>
                    </>
                  )}

                  {viewMode === "english" && <p>{turn.en_text}</p>}

                  {viewMode === "indic" && <p className="font-medium">{turn.indic_text || turn.en_text}</p>}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-4 rounded-md bg-muted/20 font-mono text-xs whitespace-pre-wrap leading-relaxed text-muted-foreground">
            {transcriptText || "No transcript available for this call."}
          </div>
        )}
      </div>
    </div>
  );
}
