import {
  AlertTriangle, ArrowLeftRight, BookOpen, Bot, Boxes, CalendarDays, CalendarClock, Cog, DoorOpen, FolderKanban,
  History, Home, Info, MessageSquareHeart, Moon, Sun, ImageUp, LayoutGrid, List, Package, Palette, Printer, Shield, Users, Wrench, type LucideIcon,
} from 'lucide-react';

/** Icona de cada mòdul */
export const MODULE_ICON: Record<string, LucideIcon> = {
  espais: CalendarClock,
  projectes: FolderKanban,
  maquines: Printer,
  manteniment: Wrench,
  incidencies: AlertTriangle,
  prestecs: Bot,
  consumibles: Package,
};

/** Icona de cada pantalla */
export const RESOURCE_ICON: Record<string, LucideIcon> = {
  sessions: CalendarClock,
  espais: DoorOpen,
  projectes: FolderKanban,
  maquines: Printer,
  usos: History,
  manteniment: Wrench,
  incidencies: AlertTriangle,
  material: Bot,
  prestecs: ArrowLeftRight,
  consumibles: Package,
  moviments: Boxes,
  cataleg: BookOpen,
};

export const NAV_ICON = {
  home: Home, calendar: CalendarDays, users: Users, modules: LayoutGrid, lists: List,
  brand: Palette, photos: ImageUp, platform: Shield, settings: Cog,
  about: Info, feedback: MessageSquareHeart, sun: Sun, moon: Moon,
};
