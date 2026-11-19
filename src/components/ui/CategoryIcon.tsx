import {
  Award,
  BookOpen,
  Brush,
  Cat,
  Coffee,
  Crown,
  Flower2,
  Frame,
  Gem,
  Gift,
  Heart,
  Image,
  KeyRound,
  Mail,
  Palette,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Sticker,
  type LucideIcon,
} from "lucide-react";
import type { CategoryIconName } from "@/lib/types";

const icons: Record<CategoryIconName, LucideIcon> = {
  print: Frame,
  sticker: Sticker,
  keychain: KeyRound,
  headband: Crown,
  sparkles: Sparkles,
  tshirt: Shirt,
  mug: Coffee,
  gift: Gift,
  heart: Heart,
  star: Star,
  palette: Palette,
  book: BookOpen,
  gem: Gem,
  cat: Cat,
  flower: Flower2,
  bag: ShoppingBag,
  badge: Award,
  postcard: Mail,
  brush: Brush,
  picture: Image,
};

export function CategoryIcon({ name, className }: { name: CategoryIconName; className?: string }) {
  const Icon = icons[name] ?? Sparkles;
  return <Icon aria-hidden className={className} strokeWidth={1.75} />;
}
