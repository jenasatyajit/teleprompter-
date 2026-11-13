"use client";

import { useState } from "react";
import { Copy, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
import { IconButton } from "@/components/icon-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { LANGUAGES } from "@/lib/prompter-options";
import { countWords } from "@/lib/script-parse";
import { useLibrary, type Script } from "@/lib/script-store";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

function timeAgo(ts: number): string {
  const diff = (ts - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return rtf.format(Math.round(diff / (86400 * 30)), "month");
}

const languageLabel = (id: Script["language"]) => LANGUAGES.find((l) => l.id === id)?.label ?? id;
const displayTitle = (s: Script) => s.title.trim() || "Untitled script";

/** Header button that collapses / expands the script sidebar (drawer on small screens). */
export function SidebarToggle() {
  const { toggleSidebar, open, openMobile, isMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;

  return (
    <IconButton
      label={expanded ? "Hide scripts" : "Show scripts"}
      shortcut="Ctrl B"
      aria-expanded={expanded}
      onClick={toggleSidebar}
    >
      {expanded && !isMobile ? <PanelLeftClose /> : <PanelLeftOpen />}
    </IconButton>
  );
}

export function ScriptSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const scripts = useLibrary((s) => s.scripts);
  const activeId = useLibrary((s) => s.activeId);
  const create = useLibrary((s) => s.create);
  const select = useLibrary((s) => s.select);
  const duplicate = useLibrary((s) => s.duplicate);
  const remove = useLibrary((s) => s.remove);
  const [pendingDelete, setPendingDelete] = useState<Script | null>(null);

  const sorted = [...scripts].sort((a, b) => b.updatedAt - a.updatedAt);
  /** After choosing something, get the drawer out of the way on small screens. */
  const done = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <>
      {/* When collapsed the panel is only moved off-screen, so make it inert for keyboard and screen readers. */}
      <Sidebar collapsible="offcanvas" aria-label="Scripts" inert={!isMobile && state === "collapsed"}>
        <SidebarHeader className="flex-row items-center justify-between gap-2 p-4 pb-2">
          <h2 className="font-display text-xl">Scripts</h2>
          <Button
            size="sm"
            onClick={() => {
              create();
              done();
            }}
          >
            <Plus /> New
          </Button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {sorted.map((s) => {
                  const active = s.id === activeId;
                  return (
                    <SidebarMenuItem key={s.id}>
                      <SidebarMenuButton
                        size="lg"
                        isActive={active}
                        aria-current={active ? "true" : undefined}
                        className="h-auto flex-col items-start gap-0.5 py-2"
                        onClick={() => {
                          select(s.id);
                          done();
                        }}
                      >
                        <span className="w-full truncate font-medium">{displayTitle(s)}</span>
                        <span className="w-full truncate font-mono text-[11px] font-normal text-sidebar-foreground/60">
                          {countWords(s.text).toLocaleString()} words · {languageLabel(s.language)} ·{" "}
                          {timeAgo(s.updatedAt)}
                        </span>
                      </SidebarMenuButton>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<SidebarMenuAction showOnHover aria-label={`Actions for ${displayTitle(s)}`} />}
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              duplicate(s.id);
                              done();
                            }}
                          >
                            <Copy /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(s)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this script?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete ? displayTitle(pendingDelete) : ""}” will be removed from this browser. This can’t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete) remove(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
