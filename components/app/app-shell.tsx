"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { SlidersHorizontal } from "lucide-react";
import { ScriptEditor } from "@/components/app/script-editor";
import { ScriptSidebar, SidebarToggle } from "@/components/app/script-sidebar";
import { SettingsDrawer } from "@/components/app/settings-drawer";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { IconButton } from "@/components/icon-button";
import { PrompterStage } from "@/components/prompter/prompter-stage";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useMounted } from "@/hooks/use-media-query";
import { useSettings } from "@/lib/settings-store";
import { APP_NAME } from "@/lib/site";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

type View = "script" | "prompt";

export function AppShell() {
  const mounted = useMounted();
  const mode = useSettings((s) => s.settings.mode);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const [view, setView] = useState<View>("script");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleSettings = useCallback(() => setSettingsOpen((o) => !o), []);
  const exitPrompter = useCallback(() => setView("script"), []);

  // Persisted state only exists in the browser; wait for it to avoid hydration mismatches.
  if (!mounted) return <div className="min-h-dvh" aria-busy="true" />;

  const settings = <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />;

  if (view === "prompt") {
    return (
      <div className="flex h-dvh min-h-0">
        <main className="flex min-h-0 min-w-0 flex-1">
          <PrompterStage
            key={mode}
            onExit={exitPrompter}
            onToggleSettings={toggleSettings}
            settingsOpen={settingsOpen}
          />
        </main>
        {settings}
      </div>
    );
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} className="h-dvh min-h-0">
      <ScriptSidebar />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-transparent">
        {/* Three columns so the logo stays centered regardless of the side controls' widths. */}
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 sm:px-5">
          <div className="flex items-center gap-2 justify-self-start">
            <SidebarToggle />
          </div>
          <h1 className="m-0 justify-self-center">
            {/* The wordmark is white; invert it to black in light mode. */}
            <Image
              src="/logo-wordmark.png"
              alt={APP_NAME}
              width={780}
              height={120}
              priority
              className="h-6 w-auto invert select-none sm:h-7 dark:invert-0"
              draggable={false}
            />
          </h1>
          <div className="flex items-center gap-1 justify-self-end">
            <IconButton
              label={settingsOpen ? "Hide settings" : "Prompter settings"}
              aria-expanded={settingsOpen}
              className={cn(settingsOpen && "bg-muted text-primary")}
              onClick={toggleSettings}
            >
              <SlidersHorizontal />
            </IconButton>
            <ThemeToggle />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ScriptEditor onStart={() => setView("prompt")} />
        </div>
      </SidebarInset>
      {settings}
    </SidebarProvider>
  );
}
