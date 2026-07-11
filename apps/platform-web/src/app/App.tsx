import { Bookmark, Edit3, Headphones, Search as SearchIcon, Server, Shield, User, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { atLeast, useSession } from "../lib/session";
import { PlaybackBar } from "./PlaybackBar";

const NAV = [
  { to: "/", label: "Listen", icon: Headphones, end: true },
  { to: "/search", label: "Search", icon: SearchIcon, end: false },
  { to: "/library", label: "Library", icon: Bookmark, end: false },
  { to: "/requests", label: "Community", icon: Users, end: false },
  { to: "/mirrors", label: "Mirrors", icon: Server, end: false },
];

export function App() {
  const { isSignedIn, me, role } = useSession();
  const canContribute = atLeast(role, "contributor");
  const canCurate = atLeast(role, "editor");

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <nav
        style={{
          width: 220,
          background: "var(--nav)",
          borderRight: "1px solid var(--line)",
          padding: "var(--s-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-1)",
          flexShrink: 0,
        }}
      >
        <div className="u-title" style={{ padding: "var(--s-2) var(--s-3) var(--s-4)" }}>
          Dervaish
        </div>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} style={navLinkStyle}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        {canContribute ? (
          <NavLink to="/studio" style={navLinkStyle}>
            <Edit3 size={18} />
            Studio
          </NavLink>
        ) : null}
        {canCurate ? (
          <NavLink to="/admin" style={navLinkStyle}>
            <Shield size={18} />
            Admin
          </NavLink>
        ) : null}
        <div style={{ flex: 1 }} />
        <NavLink to={isSignedIn ? "/account" : "/auth"} style={navLinkStyle}>
          <User size={18} />
          {isSignedIn ? (me?.display_name || "Account") : "Sign in"}
        </NavLink>
      </nav>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <main style={{ flex: 1, overflow: "auto", maxWidth: 960, width: "100%", margin: "0 auto", padding: "var(--s-5)" }}>
          <Outlet />
        </main>
        <PlaybackBar />
      </div>
    </div>
  );
}

function navLinkStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "var(--s-3)",
    padding: "var(--s-2) var(--s-3)",
    borderRadius: "var(--r-control)",
    color: isActive ? "var(--text)" : "var(--muted)",
    background: isActive ? "var(--surface-2)" : "transparent",
    fontWeight: isActive ? 600 : 400,
    textDecoration: "none",
  };
}
