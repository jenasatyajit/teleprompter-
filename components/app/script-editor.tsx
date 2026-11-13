"use client";

import { useRef, useState } from "react";
import { FileText, FileUp, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES, type Language } from "@/lib/prompter-options";
import { SAMPLE_SCRIPT, useActiveScript, useLibrary } from "@/lib/script-store";
import { countWords, formatDuration, stripMarkdown } from "@/lib/script-parse";
import { useSettings } from "@/lib/settings-store";
import { cn } from "@/lib/utils";

const MAX_IMPORT_BYTES = 1_000_000;
const LANGUAGE_ITEMS = LANGUAGES.map((l) => ({ value: l.id, label: l.label }));

export function ScriptEditor({ onStart }: { onStart: () => void }) {
  const { script, setTitle, setText, setLanguage } = useActiveScript();
  const { title, text, language } = script;
  const create = useLibrary((s) => s.create);
  const wpm = useSettings((s) => s.settings.speed);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const words = countWords(text);

  async function importFile(file: File) {
    setError(null);
    if (!/\.(txt|md|markdown)$/i.test(file.name) && !file.type.startsWith("text/")) {
      setError("Only .txt and .md files can be imported.");
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setError("That file is too large (max 1 MB).");
      return;
    }
    const raw = await file.text();
    const isMd = /\.(md|markdown)$/i.test(file.name);
    create({
      title: file.name.replace(/\.[^.]+$/, ""),
      text: isMd ? stripMarkdown(raw) : raw.replace(/\r\n?/g, "\n").trim(),
      language,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <label htmlFor="script-title" className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">
            Script
          </label>
          <Input
            id="script-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled script"
            className="h-auto border-0 bg-transparent px-0 font-display text-3xl shadow-none focus-visible:ring-0 sm:text-4xl dark:bg-transparent"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="script-language" className="text-xs uppercase tracking-widest text-muted-foreground">
            Language
          </label>
          <Select
            items={LANGUAGE_ITEMS}
            value={language}
            onValueChange={(v) => v && setLanguage(v as Language)}
          >
            <SelectTrigger id="script-language" className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_ITEMS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        className={cn(
          "relative rounded-2xl border bg-card/60 shadow-sm transition-colors",
          dragging && "border-primary bg-primary/5",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void importFile(file);
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type your script here, or drop a .txt / .md file…"
          aria-label="Script text"
          spellCheck
          className="min-h-[46dvh] resize-y rounded-2xl border-0 bg-transparent p-5 text-lg leading-relaxed shadow-none focus-visible:ring-0 sm:p-7 sm:text-xl dark:bg-transparent"
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70 font-display text-2xl">
            Drop to import
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {words.toLocaleString()} words · ~{formatDuration((words / wpm) * 60)} at {wpm} wpm
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.markdown,text/plain,text/markdown"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp /> Import
          </Button>
          <Button variant="ghost" onClick={() => setText(SAMPLE_SCRIPT)}>
            <FileText /> Sample
          </Button>
          <Button variant="ghost" onClick={() => setText("")} disabled={!text}>
            <Trash2 /> Clear
          </Button>
          <Button size="lg" className="h-10 px-5 text-base" onClick={onStart} disabled={words === 0}>
            <Play /> Start prompting
          </Button>
        </div>
      </div>
    </div>
  );
}
