import { Link, useLocation } from "wouter";
import { BarChart3, UploadCloud, List, ClipboardCheck, Users, Leaf, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: BarChart3 },
    { href: "/ingest", label: "Ingest Data", icon: UploadCloud },
    { href: "/batches", label: "Batches", icon: List },
    { href: "/records", label: "Review Records", icon: ClipboardCheck },
    { href: "/clients", label: "Clients", icon: Users },
  ];

  const currentLabel = navItems.find((item) => item.href === location)?.label || "Page";
  const initials = user ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || user.username[0].toUpperCase() : "A";

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <aside className="w-60 bg-sidebar flex flex-col shrink-0">
        <div className="h-14 flex items-center px-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sidebar-foreground text-sm tracking-tight">Breathe ESG</span>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 px-2.5 py-2 mt-1">
            Navigation
          </p>
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-all cursor-pointer group ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}>
                  <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"}`} />
                  {item.label}
                  {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-sidebar-accent/60 transition-colors group"
            >
              <div className="h-7 w-7 rounded-full bg-emerald-600/30 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-emerald-400">{initials}</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.username}</p>
                <p className="text-[10px] text-sidebar-foreground/40 truncate">{user?.email}</p>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-sidebar border border-sidebar-border rounded-lg shadow-xl overflow-hidden">
                <button
                  onClick={() => { logout(); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 px-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-sidebar-foreground/30">System Online · Django/React</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="h-14 flex items-center px-8 border-b bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground/60">Breathe ESG</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-medium text-foreground">{currentLabel}</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-background">
          {children}
        </div>
      </main>
    </div>
  );
}
