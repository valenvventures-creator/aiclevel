import {
  Brain,
  Briefcase,
  Building2,
  FileText,
  FolderKanban,
  Gavel,
  GraduationCap,
  LayoutDashboard,
  Mail,
  Settings,
  Users,
  Workflow,
  Files as FilesIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Leadership",
    items: [
      { href: "/hq", label: "C-Level HQ", icon: LayoutDashboard, shortcut: "G H" },
      { href: "/executives", label: "Executive Offices", icon: Building2, shortcut: "G E" },
      { href: "/comms", label: "Executive Comms", icon: Mail, shortcut: "G C" },
      { href: "/sessions", label: "C-Level Sessions", icon: Users, shortcut: "G S" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/memory", label: "C-Level Memory", icon: Brain, shortcut: "G M" },
      { href: "/studio", label: "C-Level Studio", icon: Workflow },
      { href: "/decisions", label: "Decisions", icon: Gavel },
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/files", label: "Files", icon: FilesIcon },
      { href: "/projects", label: "Projects", icon: FolderKanban },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/tutorials", label: "Tutorials", icon: GraduationCap },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
export { Briefcase };
