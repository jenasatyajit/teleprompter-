import { renderIcon } from "@/lib/pwa-icon";

// Maskable icons need extra padding so OS masks (circle, squircle) don't clip the art.
export function GET() {
  return renderIcon(512, 0.26);
}
