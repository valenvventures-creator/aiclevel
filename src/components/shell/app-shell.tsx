"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Menu, Search, X } from "lucide-react";
import { Crest } from "@/components/brand/brand";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { CommandPalette } from "./command-palette";
import { NAV_SECTIONS } from "./nav-config";
import { cn, formatRelative } from "@/lib/utils";
import type { ExecutiveStatus, Notification, Role } from "@/types/domain";

export interface ShellExecutive {
  id: string;
  slug: string;
  title: string;
  short_title: string;
  avatar_url: string | null;
  accent: string;
  status: ExecutiveStatus;
}

export interface ShellProps {
  user: { first_name: string; last_name: string; email: string; email_verified: boolean };
  organization: { id: string; name: string; is_demo: boolean };
  memberships: { id: string; name: string }[];
  role: Role;
  executives: ShellExecutive[];
  notifications: Notification[];
  providers: { anthropic: boolean; openai: boolean; simulated: boolean };
  dataMode: "demo" | "supabase";
  logoutAction: () => Promise<void>;
  switchOrgAction: (fd: FormData) => Promise<void>;
  markNotificationsReadAction: () => Promise<void>;
  children: ReactNode;
}

const ShellCtx = createContext<{ executives: ShellExecutive[] }>({ executives: [] });
export const useShell = () => useContext(ShellCtx);

export function AppShell(props: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Close the mobile drawer on navigation (state reset on prop change, without an effect).
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setDrawer(false);
  }

  useEffect(() => {
    // Sync from an external system (per-device preference in localStorage) after hydration.
    let stored = false;
    try {
      stored = localStorage.getItem("ta.sidebar") === "collapsed";
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage is only possible after mount
    if (stored) setCollapsed(true);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      // Esc closes the mobile navigation drawer.
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("ta.sidebar", c ? "expanded" : "collapsed");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  return (
    <ShellCtx.Provider value={{ executives: props.executives }}>
      <div className="flex min-h-dvh">
        {/* Desktop / tablet sidebar */}
        <aside className={cn("sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-ink-1000/60 transition-[width] duration-300 md:flex md:flex-col", collapsed ? "w-[76px]" : "w-[264px]")} aria-label="Primary">
          <SidebarContent {...props} collapsed={collapsed} pathname={pathname} />
          <button onClick={toggleCollapsed} className="m-3 flex h-9 items-center justify-center gap-2 rounded-lg text-xs text-ivory-faint hover:bg-white/[0.03] hover:text-ivory" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
          </button>
        </aside>

        {/* Mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawer(false)} aria-label="Close navigation" />
            <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,300px)] animate-fade-up flex-col border-r border-line bg-ink-950">
              <button onClick={() => setDrawer(false)} className="absolute right-3 top-4 grid size-9 place-items-center rounded-lg text-ivory-muted hover:bg-white/5" aria-label="Close navigation">
                <X className="size-5" />
              </button>
              <SidebarContent {...props} collapsed={false} pathname={pathname} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {props.organization.is_demo && (
            <div className="border-b border-warn/20 bg-warn/[0.06] px-4 py-1.5 text-center text-xs text-warn" role="status">
              <strong>Demo organization.</strong> All data is simulated and A.I. output is labelled — nothing here is live model output unless marked otherwise.
            </div>
          )}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-ink-950/80 px-4 backdrop-blur-xl sm:px-6">
            <button className="grid size-9 place-items-center rounded-lg text-ivory-muted hover:bg-white/5 md:hidden" onClick={() => setDrawer(true)} aria-label="Open navigation">
              <Menu className="size-5" />
            </button>
            <button onClick={() => setPaletteOpen(true)} className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-full border border-line bg-white/[0.02] px-4 text-left text-sm text-ivory-faint transition hover:border-line-strong sm:max-w-md" aria-label="Search and commands (Command K)">
              <Search className="size-4 shrink-0" />
              <span className="truncate">Ask an executive, search intelligence…</span>
              <kbd className="ml-auto hidden rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-ivory-muted sm:inline">⌘K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <ProviderStatus providers={props.providers} />
              <NotificationCenter items={props.notifications} markRead={props.markNotificationsReadAction} />
            </div>
          </header>
          <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
            {!props.user.email_verified && (
              <div className="mx-auto mb-6 max-w-7xl rounded-xl border border-info/25 bg-info/[0.05] px-4 py-2.5 text-sm text-info">
                Verify your email to invite team members.{" "}
                <Link href="/verify-email" className="underline underline-offset-2">Verify now</Link>
              </div>
            )}
            <div className="mx-auto max-w-7xl">{props.children}</div>
          </main>
        </div>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} executives={props.executives} />}
    </ShellCtx.Provider>
  );
}

function SidebarContent(props: ShellProps & { collapsed: boolean; pathname: string }) {
  const { collapsed, pathname } = props;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("flex h-16 items-center border-b border-line", collapsed ? "justify-center" : "px-5")}>
        <Link href="/hq" className="flex items-center gap-3" aria-label="C-Suite HQ">
          <Crest size={collapsed ? 38 : 44} />
          {!collapsed && (
            <span className="leading-none">
              <span className="block font-display text-[11.5px] font-semibold tracking-[0.16em] text-gold-300">THOUGHT AUTHORITIES</span>
              <span className="mt-1 block font-mono text-[9px] tracking-[0.3em] text-ivory-faint">A.I. C-LEVEL</span>
            </span>
          )}
        </Link>
      </div>

      {!collapsed && <OrganizationSwitcher {...props} />}

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            {!collapsed && <p className="mb-1.5 px-3 font-mono text-[10px] tracking-[0.22em] text-ivory-faint">{section.label.toUpperCase()}</p>}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-10 items-center gap-3 rounded-xl text-sm transition",
                        collapsed ? "justify-center" : "px-3",
                        active ? "bg-gold-400/[0.08] text-gold-200" : "text-ivory-muted hover:bg-white/[0.03] hover:text-ivory",
                      )}
                    >
                      {active && <span className="absolute left-0 top-2 h-6 w-[2px] rounded-full bg-gold-400" aria-hidden />}
                      <item.icon className="size-[18px] shrink-0" aria-hidden />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div>
          {!collapsed && <p className="mb-2 px-3 font-mono text-[10px] tracking-[0.22em] text-ivory-faint">YOUR C-SUITE</p>}
          <ul className={cn("flex gap-1.5", collapsed ? "flex-col items-center" : "flex-wrap px-3")}>
            {props.executives.map((e) => (
              <li key={e.id}>
                <Link href={`/executives/${e.slug}`} title={e.title} aria-label={`${e.title} — ${e.status.toLowerCase()}`} className="block rounded-full transition hover:scale-105">
                  <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={32} status={e.status} ring={false} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <UserMenu {...props} />
    </div>
  );
}

function OrganizationSwitcher(props: ShellProps) {
  if (props.memberships.length < 2) {
    return (
      <div className="mx-3 mt-4 rounded-xl border border-line bg-white/[0.015] px-3 py-2.5">
        <p className="font-mono text-[9.5px] tracking-[0.2em] text-ivory-faint">ORGANIZATION</p>
        <p className="mt-0.5 truncate text-sm font-medium">{props.organization.name}</p>
      </div>
    );
  }
  return (
    <form action={props.switchOrgAction} className="mx-3 mt-4">
      <label htmlFor="org-switch" className="font-mono text-[9.5px] tracking-[0.2em] text-ivory-faint">ORGANIZATION</label>
      <select id="org-switch" name="organization_id" defaultValue={props.organization.id} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="mt-1 h-10 w-full rounded-xl border border-line bg-ink-900 px-3 text-sm">
        {props.memberships.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    </form>
  );
}

function UserMenu(props: ShellProps & { collapsed: boolean }) {
  const initials = `${props.user.first_name[0] ?? ""}${props.user.last_name[0] ?? ""}`.toUpperCase();
  return (
    <div className={cn("flex items-center gap-3 border-t border-line p-3", props.collapsed && "flex-col")}>
      <Link href="/settings/profile" className="grid size-9 shrink-0 place-items-center rounded-full border border-line-gold bg-gold-400/10 font-display text-xs text-gold-200" aria-label="Your profile">
        {initials}
      </Link>
      {!props.collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{props.user.first_name} {props.user.last_name}</p>
          <p className="truncate font-mono text-[10px] tracking-[0.14em] text-ivory-faint">{props.role}</p>
        </div>
      )}
      <form action={props.logoutAction}>
        <button className="grid size-9 place-items-center rounded-lg text-ivory-faint hover:bg-white/5 hover:text-ivory" aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

function ProviderStatus({ providers }: { providers: ShellProps["providers"] }) {
  const live = providers.anthropic || providers.openai;
  return (
    <span className={cn("hidden items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] sm:inline-flex", live ? "border-ok/25 text-ok" : "border-warn/25 text-warn")} title={live ? `Connected: ${[providers.anthropic && "Claude", providers.openai && "OpenAI"].filter(Boolean).join(", ")}` : "No A.I. provider connected — executive output is simulated"} role="status">
      <span className={cn("size-1.5 rounded-full", live ? "bg-ok" : "animate-pulse-soft bg-warn")} />
      {live ? "ENGINE LIVE" : "SIMULATION"}
    </span>
  );
}

function NotificationCenter({ items, markRead }: { items: Notification[]; markRead: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const unread = items.filter((i) => !i.read_at).length;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative grid size-10 place-items-center rounded-full border border-line text-ivory-muted hover:text-ivory" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-gold-400 px-1 font-mono text-[9px] text-ink-950">{unread}</span>}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close notifications" tabIndex={-1} />
          <div className="absolute right-0 z-50 mt-2 w-[min(92vw,360px)] animate-fade-up overflow-hidden rounded-2xl border border-line-strong bg-ink-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-medium">Notifications</p>
              {unread > 0 && (
                <form action={markRead}>
                  <button className="text-xs text-gold-300 hover:text-gold-200">Mark all read</button>
                </form>
              )}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-ivory-muted">You&apos;re all caught up.</li>}
              {items.map((n) => (
                <li key={n.id} className="border-b border-line last:border-0">
                  <Link href={n.target_url ?? "#"} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-white/[0.02]">
                    <div className="flex items-start gap-2">
                      {!n.read_at && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold-400" aria-label="Unread" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="mt-0.5 text-xs text-ivory-muted">{n.message}</p>
                        <p className="mt-1 font-mono text-[10px] text-ivory-faint">{formatRelative(n.created_at)}</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
