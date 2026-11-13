"use client";

import { useCallback, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ScriptEditor } from "@/components/app/script-editor";
import { ScriptSidebar, SidebarToggle } from "@/components/app/script-sidebar";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { IconButton } from "@/components/icon-button";
import { PrompterStage } from "@/components/prompter/prompter-stage";
import { SettingsPanel } from "@/components/prompter/settings-panel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useMediaQuery, useMounted } from "@/hooks/use-media-query";
import { useSettings } from "@/lib/settings-store";
import { useUi } from "@/lib/ui-store";

type View = "script" | "prompt";

export function AppShell() {
  const mounted = useMounted();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const mode = useSettings((s) => s.settings.mode);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const [view, setView] = useState<View>("script");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleSettings = useCallback(() => setSettingsOpen((o) => !o), []);
  const exitPrompter = useCallback(() => setView("script"), []);

  // Persisted state only exists in the browser; wait for it to avoid hydration mismatches.
  if (!mounted) return <div className="min-h-dvh" aria-busy="true" />;

  const docked = view === "prompt" && isDesktop;

  return (
    <>
      {view === "script" ? (
        <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} className="h-dvh min-h-0">
          <ScriptSidebar />
          <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-transparent">
            <header className="flex shrink-0 items-center justify-between px-3 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <SidebarToggle />
                <span className="font-display text-2xl italic tracking-tight">
                  cue<span className="text-primary">.</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <IconButton label="Prompter settings" onClick={toggleSettings}>
                  <SlidersHorizontal />
                </IconButton>
                <ThemeToggle />
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ScriptEditor onStart={() => setView("prompt")} />
            </div>
          </SidebarInset>
        </SidebarProvider>
      ) : (
        <div className="flex h-dvh min-h-0">
          <main className="flex min-h-0 min-w-0 flex-1">
            <PrompterStage
              key={mode}
              onExit={exitPrompter}
              onToggleSettings={toggleSettings}
              settingsOpen={settingsOpen}
            />
          </main>
          {docked && settingsOpen && (
            <aside
              aria-label="Prompter settings"
              className="w-[22rem] shrink-0 border-l bg-card text-card-foreground"
            >
              <SettingsPanel />
            </aside>
          )}
        </div>
      )}

      {!docked && (
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetContent
            side={isDesktop ? "right" : "bottom"}
            className="max-h-[85dvh] gap-0 p-0 data-[side=right]:sm:max-w-sm data-[side=bottom]:rounded-t-2xl"
          >
            <SettingsPanel
              title={<SheetTitle className="font-display text-xl">Settings</SheetTitle>}
            />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
