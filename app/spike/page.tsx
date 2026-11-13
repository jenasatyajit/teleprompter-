"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeepgramKey } from "@/lib/deepgram-key";

type Lang = "en" | "hi" | "hinglish";

type Result = {
  isFinal: boolean;
  transcript: string;
  raw: unknown;
};

function buildUrl(lang: Lang, sampleRate: number) {
  const p = new URLSearchParams({
    model: "nova-3",
    encoding: "linear16",
    sample_rate: String(sampleRate),
    channels: "1",
    interim_results: "true",
    smart_format: "true",
    punctuate: "true",
  });
  if (lang === "en") {
    p.set("language", "en");
  } else if (lang === "hi") {
    p.set("language", "hi");
  } else {
    // Hinglish: code-switching model, Deepgram recommends endpointing=100.
    p.set("language", "multi");
    p.set("endpointing", "100");
    p.append("language_hint", "en");
    p.append("language_hint", "hi");
  }
  return `wss://api.deepgram.com/v1/listen?${p.toString()}`;
}

export default function SpikePage() {
  const { key, setKey } = useDeepgramKey();
  const [draftKey, setDraftKey] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState<Result[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const keepAliveRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (keepAliveRef.current) window.clearInterval(keepAliveRef.current);
    keepAliveRef.current = null;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "CloseStream" }));
      ws.close();
    }
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setRunning(false);
    setStatus("stopped");
  }, []);

  const start = useCallback(async () => {
    setResults([]);
    if (!key) {
      setStatus("enter your Deepgram API key first");
      return;
    }
    try {
      setStatus("requesting mic...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      await ctx.audioWorklet.addModule("/pcm-worklet.js");
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pcm-processor");
      source.connect(node);

      setStatus("connecting...");
      const ws = new WebSocket(buildUrl(lang, ctx.sampleRate), ["token", key]);
      wsRef.current = ws;

      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
      };

      ws.onopen = () => {
        setStatus("listening");
        setRunning(true);
        keepAliveRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 5000);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string);
        if (msg.type !== "Results") return;
        const transcript: string = msg.channel?.alternatives?.[0]?.transcript ?? "";
        if (!transcript) return;
        setResults((r) =>
          [{ isFinal: !!msg.is_final, transcript, raw: msg }, ...r].slice(0, 40),
        );
      };
      ws.onerror = () => setStatus("websocket error");
      ws.onclose = (e) => {
        setStatus(`closed (${e.code}) ${e.reason}`);
        setRunning(false);
      };
    } catch (err) {
      setStatus(`error: ${String(err)}`);
      stop();
    }
  }, [lang, key, stop]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6 font-sans">
      <h1 className="text-xl font-semibold">Deepgram spike</h1>

      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setKey(draftKey);
          setDraftKey("");
        }}
      >
        <input
          type="password"
          autoComplete="off"
          className="min-w-64 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          placeholder={key ? "Key saved in this browser" : "Paste Deepgram API key"}
          value={draftKey}
          onChange={(e) => setDraftKey(e.target.value)}
          aria-label="Deepgram API key"
        />
        <Button type="submit" variant="secondary" disabled={!draftKey.trim()}>
          Save key
        </Button>
        {key && (
          <Button type="button" variant="ghost" onClick={() => setKey("")}>
            Clear
          </Button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={lang}
          disabled={running}
          onChange={(e) => setLang(e.target.value as Lang)}
          aria-label="Language"
        >
          <option value="en">English (en)</option>
          <option value="hi">Hindi (hi)</option>
          <option value="hinglish">Hinglish (multi + hints)</option>
        </select>
        <Button onClick={running ? stop : start}>{running ? "Stop" : "Start"}</Button>
        <span className="text-sm text-muted-foreground" role="status">
          {status}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {results.map((r, i) => (
          <li key={i} className="rounded-md border p-3 text-sm">
            <span className="mr-2 text-xs uppercase text-muted-foreground">
              {r.isFinal ? "final" : "interim"}
            </span>
            <span className="text-base">{r.transcript}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
