"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "@/lib/prompter-options";

export type StreamStatus = "idle" | "connecting" | "listening" | "error";

type Options = {
  apiKey: string;
  language: Language;
  /** Called for every transcript update. `text` is the whole current segment. */
  onResult: (text: string, isFinal: boolean) => void;
};

const MAX_RETRIES = 3;

function buildUrl(language: Language, sampleRate: number) {
  const p = new URLSearchParams({
    model: "nova-3",
    encoding: "linear16",
    sample_rate: String(sampleRate),
    channels: "1",
    interim_results: "true",
    smart_format: "true",
  });
  if (language === "en") {
    p.set("language", "en");
  } else if (language === "hi") {
    p.set("language", "hi");
  } else {
    // Hinglish: multilingual code-switching. Deepgram recommends endpointing=100 for it.
    p.set("language", "multi");
    p.set("endpointing", "100");
    p.append("language_hint", "en");
    p.append("language_hint", "hi");
  }
  return `wss://api.deepgram.com/v1/listen?${p.toString()}`;
}

/**
 * Streams the microphone to Deepgram and reports transcripts.
 * Auth uses the user's own key (kept in localStorage) via the WebSocket subprotocol.
 */
export function useDeepgramStream({ apiKey, language, onResult }: Options) {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  /** 0..1 input level, updated ~10x/second. Read it from a ref to avoid re-renders. */
  const levelRef = useRef(0);

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const keepAliveRef = useRef<number | null>(null);
  const retryRef = useRef(0);
  const wantRef = useRef(false);

  const teardown = useCallback(() => {
    wantRef.current = false;
    if (keepAliveRef.current) window.clearInterval(keepAliveRef.current);
    keepAliveRef.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "CloseStream" }));
        } catch {
          /* socket already closing */
        }
      }
      if (ws.readyState <= WebSocket.OPEN) ws.close();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    levelRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    teardown();
    setStatus("idle");
  }, [teardown]);

  const fail = useCallback(
    (message: string) => {
      teardown();
      setError(message);
      setStatus("error");
    },
    [teardown],
  );

  const start = useCallback(async () => {
    if (!apiKey) {
      fail("Add your Deepgram API key in Settings → Flow to use voice mode.");
      return;
    }
    teardown();
    wantRef.current = true;
    retryRef.current = 0;
    setError(null);
    setStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      if (!wantRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      await ctx.audioWorklet.addModule("/pcm-worklet.js");
      if (!wantRef.current) return;

      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pcm-processor");
      source.connect(node);

      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(e.data);
        // Cheap RMS level for the UI meter.
        const samples = new Int16Array(e.data);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 8) sum += (samples[i] / 32768) ** 2;
        levelRef.current = Math.min(1, Math.sqrt(sum / (samples.length / 8)) * 6);
      };

      const connect = () => {
        const ws = new WebSocket(buildUrl(language, ctx.sampleRate), ["token", apiKey]);
        wsRef.current = ws;

        ws.onopen = () => {
          retryRef.current = 0;
          setStatus("listening");
          if (keepAliveRef.current) window.clearInterval(keepAliveRef.current);
          keepAliveRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "KeepAlive" }));
          }, 5000);
        };

        ws.onmessage = (e) => {
          if (typeof e.data !== "string") return;
          let msg: { type?: string; is_final?: boolean; channel?: { alternatives?: { transcript?: string }[] } };
          try {
            msg = JSON.parse(e.data);
          } catch {
            return;
          }
          if (msg.type !== "Results") return;
          const text = msg.channel?.alternatives?.[0]?.transcript ?? "";
          onResultRef.current(text, !!msg.is_final);
        };

        ws.onclose = () => {
          if (!wantRef.current || wsRef.current !== ws) return;
          if (keepAliveRef.current) window.clearInterval(keepAliveRef.current);
          if (retryRef.current >= MAX_RETRIES) {
            fail("Could not reach Deepgram. Check your API key and internet connection.");
            return;
          }
          retryRef.current++;
          setStatus("connecting");
          window.setTimeout(() => {
            if (wantRef.current) connect();
          }, 800 * retryRef.current);
        };
      };

      connect();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        fail("Microphone access was blocked. Allow it in your browser and try again.");
      } else if (name === "NotFoundError") {
        fail("No microphone was found.");
      } else {
        fail(`Could not start listening: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [apiKey, language, teardown, fail]);

  // Release the mic when the component using the hook goes away.
  useEffect(() => teardown, [teardown]);

  return { status, error, levelRef, start, stop };
}
