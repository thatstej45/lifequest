import {
  Activity,
  Ban,
  Bed,
  Book,
  BookOpen,
  Brain,
  Briefcase,
  Calendar,
  Camera,
  Clock,
  Code,
  Coffee,
  DollarSign,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Gamepad2,
  Ghost,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  HeartPulse,
  Languages,
  Leaf,
  ListChecks,
  Music,
  Palette,
  Shield,
  Skull,
  Sparkles,
  Star,
  Sun,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  User,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

export const ICON_NAMES = [
  'Activity',
  'Ban',
  'Bed',
  'Book',
  'BookOpen',
  'Brain',
  'Briefcase',
  'Calendar',
  'Camera',
  'Clock',
  'Code',
  'Coffee',
  'DollarSign',
  'Droplets',
  'Dumbbell',
  'Flame',
  'Footprints',
  'Gamepad2',
  'Ghost',
  'Globe',
  'GraduationCap',
  'Hash',
  'Heart',
  'HeartPulse',
  'Languages',
  'Leaf',
  'ListChecks',
  'Music',
  'Palette',
  'Shield',
  'Skull',
  'Sparkles',
  'Star',
  'Sun',
  'Target',
  'Timer',
  'TrendingUp',
  'Trophy',
  'User',
  'Users',
  'Wallet',
  'Zap',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const ICON_MAP: Record<IconName, LucideIcon> = {
  Activity,
  Ban,
  Bed,
  Book,
  BookOpen,
  Brain,
  Briefcase,
  Calendar,
  Camera,
  Clock,
  Code,
  Coffee,
  DollarSign,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Gamepad2,
  Ghost,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  HeartPulse,
  Languages,
  Leaf,
  ListChecks,
  Music,
  Palette,
  Shield,
  Skull,
  Sparkles,
  Star,
  Sun,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  User,
  Users,
  Wallet,
  Zap,
};

const DEFAULT_ICON: LucideIcon = Activity;

export function isIconName(name: string): name is IconName {
  return (ICON_NAMES as readonly string[]).includes(name);
}

export function getIconComponent(name: string): LucideIcon {
  if (isIconName(name)) {
    return ICON_MAP[name];
  }
  return DEFAULT_ICON;
}

export interface HabitIconProps extends LucideProps {
  name: string;
  fallback?: IconName;
}

export function HabitIcon({ name, fallback = 'Activity', size = 20, color = 'currentColor', ...props }: HabitIconProps) {
  const Icon = isIconName(name) ? ICON_MAP[name] : ICON_MAP[fallback];
  return <Icon size={size} color={color} aria-hidden={props['aria-label'] ? undefined : true} {...props} />;
}
