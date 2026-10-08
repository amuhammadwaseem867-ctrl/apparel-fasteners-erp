"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

import "./AppShell.css";

export default function AppShell({ children }) {
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarExpanded =
    sidebarPinned || sidebarHovered;

  const shellState = sidebarExpanded
    ? "app-shell--expanded"
    : "app-shell--collapsed";

  return (
    <div className={`app-shell ${shellState}`}>
      <Sidebar
        pinned={sidebarPinned}
        hovered={sidebarHovered}
        expanded={sidebarExpanded}
        mobileOpen={mobileOpen}
        setPinned={setSidebarPinned}
        setHovered={setSidebarHovered}
        setMobileOpen={setMobileOpen}
      />

      <div className="app-shell__workspace">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="app-shell__main">
          <div className="app-shell__content">
            {children}
          </div>
        </main>
      </div>

      {mobileOpen && (
        <button
          type="button"
          className="app-shell__mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
    </div>
  );
}