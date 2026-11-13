"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = Omit<ComponentProps<typeof Button>, "children" | "aria-label"> & {
  label: string;
  shortcut?: string;
  children: React.ReactNode;
};

/** Icon-only button with an accessible name and a tooltip. */
export function IconButton({ label, shortcut, children, ...props }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button aria-label={label} variant="ghost" size="icon" {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && (
          <kbd className="ml-2 rounded bg-background/20 px-1 font-mono text-[10px]">{shortcut}</kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
