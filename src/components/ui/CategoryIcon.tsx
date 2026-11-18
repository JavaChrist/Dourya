import { Crown, Frame, KeyRound, Sparkles, Sticker, type LucideIcon } from "lucide-react";
import type { CategoryIconName } from "@/lib/types";

const icons: Record<CategoryIconName, LucideIcon> = {
  print: Frame,
  sticker: Sticker,
  keychain: KeyRound,
  headband: Crown,
  sparkles: Sparkles,
};

export function CategoryIcon({ name, className }: { name: CategoryIconName; className?: string }) {
  const Icon = icons[name] ?? Sparkles;
  return <Icon aria-hidden className={className} strokeWidth={1.75} />;
}
