"use client";

import { useId, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  COLOR_PRESETS,
  PROMPTER_FONTS,
  type Align,
  type FontId,
  type Mode,
} from "@/lib/prompter-options";
import { useDeepgramKey } from "@/lib/deepgram-key";
import { useSettings } from "@/lib/settings-store";
import { cn } from "@/lib/utils";

const FONT_ITEMS = PROMPTER_FONTS.map((f) => ({ value: f.id, label: f.label }));
const COUNTDOWN_ITEMS = [0, 3, 5, 10].map((n) => ({
  value: String(n),
  label: n === 0 ? "Off" : `${n} seconds`,
}));

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-2.5">
      <div className="flex items-baseline justify-between">
        <Label id={id}>{label}</Label>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider
        aria-labelledby={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  );
}

function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs uppercase text-muted-foreground">{value}</span>
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
      </div>
    </div>
  );
}

function DeepgramKeyField() {
  const { key, setKey } = useDeepgramKey();
  const [draft, setDraft] = useState("");
  const id = useId();

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        setKey(draft);
        setDraft("");
      }}
    >
      <Label htmlFor={id}>Deepgram API key</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={key ? "•••••••• saved in this browser" : "Paste your key"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={!draft.trim()}>
          Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {key ? (
          <>
            Key saved.{" "}
            <button type="button" onClick={() => setKey("")} className="underline underline-offset-2">
              Remove
            </button>
          </>
        ) : (
          "Stored only in this browser, never on a server."
        )}
      </p>
    </form>
  );
}

export function SettingsPanel({
  className,
  title,
}: {
  className?: string;
  /** Replace the default heading (e.g. with a SheetTitle). */
  title?: React.ReactNode;
}) {
  const s = useSettings((st) => st.settings);
  const set = useSettings((st) => st.set);
  const patch = useSettings((st) => st.patch);
  const reset = useSettings((st) => st.reset);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 pr-14">
        {title ?? <h2 className="font-display text-xl">Settings</h2>}
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw /> Reset
        </Button>
      </div>

      <div className="px-5 pb-4">
        <Label className="mb-2 block">Mode</Label>
        <ToggleGroup
          variant="outline"
          spacing={0}
          className="w-full"
          value={[s.mode]}
          onValueChange={(v) => v[0] && set("mode", v[0] as Mode)}
          aria-label="Scroll mode"
        >
          <ToggleGroupItem value="voice" className="flex-1 data-pressed:bg-primary data-pressed:text-primary-foreground">
            Voice
          </ToggleGroupItem>
          <ToggleGroupItem value="auto" className="flex-1 data-pressed:bg-primary data-pressed:text-primary-foreground">
            Auto
          </ToggleGroupItem>
          <ToggleGroupItem value="manual" className="flex-1 data-pressed:bg-primary data-pressed:text-primary-foreground">
            Manual
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Tabs defaultValue="text" className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-5 grid w-auto grid-cols-4">
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="color">Color</TabsTrigger>
          <TabsTrigger value="behavior">Flow</TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <TabsContent value="text" className="grid gap-6">
            <div className="grid gap-2.5">
              <Label>Font</Label>
              <Select
                items={FONT_ITEMS}
                value={s.fontFamily}
                onValueChange={(v) => v && set("fontFamily", v as FontId)}
              >
                <SelectTrigger className="w-full" aria-label="Font family">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_ITEMS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SliderField label="Size" value={s.fontSize} min={20} max={160} step={2} format={(v) => `${v}px`} onChange={(v) => set("fontSize", v)} />
            <SliderField label="Weight" value={s.fontWeight} min={300} max={800} step={100} onChange={(v) => set("fontWeight", v)} />
            <SliderField label="Line height" value={s.lineHeight} min={1.1} max={2.2} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => set("lineHeight", v)} />
            <SliderField label="Letter spacing" value={s.letterSpacing} min={-0.03} max={0.12} step={0.005} format={(v) => `${v.toFixed(3)}em`} onChange={(v) => set("letterSpacing", v)} />
            <div className="grid gap-2.5">
              <Label>Alignment</Label>
              <ToggleGroup
                variant="outline"
                spacing={0}
                className="w-full"
                value={[s.align]}
                onValueChange={(v) => v[0] && set("align", v[0] as Align)}
                aria-label="Text alignment"
              >
                {(
                  [
                    ["left", AlignLeft, "Left"],
                    ["center", AlignCenter, "Center"],
                    ["right", AlignRight, "Right"],
                    ["justify", AlignJustify, "Justify"],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    aria-label={label}
                    className="flex-1 data-pressed:bg-primary data-pressed:text-primary-foreground"
                  >
                    <Icon />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </TabsContent>

          <TabsContent value="layout" className="grid gap-6">
            <SliderField label="Text width" value={s.textWidth} min={30} max={100} step={1} format={(v) => `${v}%`} onChange={(v) => set("textWidth", v)} />
            <SliderField label="Side margin" value={s.sideMargin} min={0} max={160} step={4} format={(v) => `${v}px`} onChange={(v) => set("sideMargin", v)} />
            <SliderField label="Reading line" value={s.readingLine} min={10} max={80} step={1} format={(v) => `${v}% from top`} onChange={(v) => set("readingLine", v)} />
            <p className="-mt-3 text-xs text-muted-foreground">
              You can also drag the arrow on the line itself, or press [ and ] while prompting.
            </p>
            <SwitchField label="Show reading line" checked={s.showReadingLine} onChange={(v) => set("showReadingLine", v)} />
            <div className="grid gap-3">
              <Label>Mirror</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={s.mirrorH ? "default" : "outline"}
                  onClick={() => set("mirrorH", !s.mirrorH)}
                  aria-pressed={s.mirrorH}
                >
                  <FlipHorizontal2 /> Horizontal
                </Button>
                <Button
                  variant={s.mirrorV ? "default" : "outline"}
                  onClick={() => set("mirrorV", !s.mirrorV)}
                  aria-pressed={s.mirrorV}
                >
                  <FlipVertical2 /> Vertical
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use horizontal mirroring with a beam-splitter glass rig.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="color" className="grid gap-6">
            <div className="grid gap-2.5">
              <Label>Theme</Label>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_PRESETS.map((p) => {
                  const active =
                    p.text === s.textColor && p.background === s.backgroundColor && p.highlight === s.highlightColor;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        patch({ textColor: p.text, backgroundColor: p.background, highlightColor: p.highlight })
                      }
                      aria-pressed={active}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        active && "border-primary ring-1 ring-primary",
                      )}
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-md border font-display text-lg"
                        style={{ background: p.background, color: p.text }}
                      >
                        <span>A</span>
                        <span style={{ color: p.highlight }}>a</span>
                      </span>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <ColorField label="Text" value={s.textColor} onChange={(v) => set("textColor", v)} />
            <ColorField label="Background" value={s.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
            <ColorField label="Highlight" value={s.highlightColor} onChange={(v) => set("highlightColor", v)} />
          </TabsContent>

          <TabsContent value="behavior" className="grid gap-6">
            <section className="grid gap-4 rounded-xl border bg-muted/40 p-4">
              <div>
                <h3 className="text-sm font-medium">Voice mode</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Follows your voice using Deepgram. Language comes from the script (English, Hindi or Hinglish).
                </p>
              </div>
              <DeepgramKeyField />
              <SwitchField
                label="Mark skipped words"
                hint="Underline words you jumped over."
                checked={s.markSkipped}
                onChange={(v) => set("markSkipped", v)}
              />
              <SwitchField
                label="Keep moving when silent"
                hint="Continue at the speed below if you stop talking."
                checked={s.silenceFallback}
                onChange={(v) => set("silenceFallback", v)}
              />
              {s.silenceFallback && (
                <SliderField
                  label="Wait before moving"
                  value={s.silenceSeconds}
                  min={2}
                  max={15}
                  step={1}
                  format={(v) => `${v}s`}
                  onChange={(v) => set("silenceSeconds", v)}
                />
              )}
            </section>
            <SliderField label="Auto-scroll speed" value={s.speed} min={40} max={300} step={5} format={(v) => `${v} wpm`} onChange={(v) => set("speed", v)} />
            <div className="grid gap-2.5">
              <Label>Countdown</Label>
              <Select
                items={COUNTDOWN_ITEMS}
                value={String(s.countdown)}
                onValueChange={(v) => v != null && set("countdown", Number(v))}
              >
                <SelectTrigger className="w-full" aria-label="Countdown before start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTDOWN_ITEMS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SwitchField label="Dim words already read" checked={s.dimRead} onChange={(v) => set("dimRead", v)} />
            {s.dimRead && (
              <SliderField label="Dim level" value={s.dimOpacity} min={0.05} max={0.8} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set("dimOpacity", v)} />
            )}
            <SwitchField label="Highlight current line" checked={s.highlightLine} onChange={(v) => set("highlightLine", v)} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
