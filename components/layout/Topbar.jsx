"use client";

/*
 * The top bar (D-042). Page title from the menu; search across pages and
 * records (orders, customers, production orders, invoices, items,
 * shipments) the user may see; a "New" menu of the actions the user is
 * allowed; a bell with real waiting work; and the profile menu with
 * My profile, Settings and a working Sign out. Menus close on Escape, on
 * a click outside and on navigation.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Command,
  CornerDownLeft,
  Factory,
  FileText,
  Loader2,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { NAV_PAGES, navEntryFor } from "@/config/navigation";

import "./Topbar.css";

/* The "New" menu: each action shows only with the permission it needs. */
const QUICK_ACTIONS = [
  { label: "New invoice", description: "Order sheet with rates; approving it makes the order", href: "/finance/invoices/new", icon: ShoppingCart, permission: "finance:create" },
  { label: "New customer", description: "Name, address, contact, NTN / STRN", href: "/sales/customers", icon: UserPlus, permission: "customers:create" },
  { label: "Issue raw material", description: "Material to a production order", href: "/production/material-issue", icon: Factory, permission: "inventory:create" },
  { label: "Record QC", description: "Inspection for a production order", href: "/quality/inspections", icon: ClipboardCheck, permission: "quality:create" },
  { label: "Packing list", description: "Cartons, bags and weights", href: "/packing/orders", icon: PackageCheck, permission: "production:update" },
  { label: "Shipment", description: "Dispatch packed goods", href: "/dispatch/shipments", icon: Truck, permission: "dispatch:create" },
  { label: "Gate pass", description: "Inward or outward", href: "/dispatch/gate-passes", icon: FileText, permission: "inventory:create" },
  { label: "Purchase order", description: "Raw material from a supplier", href: "/procurement/purchase-orders", icon: Package, permission: "purchasing:create" },
];

/* Record searches: list API, permission, and how a row shows and opens. */
const RECORD_SEARCHES = [
  { group: "Orders", permission: "sales:view", path: (q) => `/api/sales/orders?search=${q}&pageSize=5`, rows: (data) => data.orders, show: (row) => ({ title: row.orderNumber, text: `${row.customerName ?? ""} · ${String(row.status).toLowerCase()}`, href: `/sales/orders/${row.id}` }), icon: ShoppingCart },
  { group: "Customers", permission: "customers:view", path: (q) => `/api/customers?search=${q}&pageSize=5`, rows: (data) => data.customers, show: (row) => ({ title: row.name, text: [row.contactPerson, row.phone].filter(Boolean).join(" · ") || row.code, href: "/sales/customers" }), icon: Users },
  { group: "Production orders", permission: "production:view", path: (q) => `/api/production/orders?search=${q}&pageSize=5`, rows: (data) => data.orders, show: (row) => ({ title: row.orderNumber, text: `${row.productName ?? row.sku ?? ""} · ${String(row.status).toLowerCase().replace("_", " ")}`, href: `/production/orders/${row.id}` }), icon: Factory },
  { group: "Invoices", permission: "finance:view", path: (q) => `/api/finance/invoices?search=${q}&pageSize=5`, rows: (data) => data.invoices, show: (row) => ({ title: row.invoiceNumber, text: `${row.customerName ?? ""} · ${String(row.status).toLowerCase()}`, href: `/finance/invoices/${row.id}` }), icon: FileText },
  { group: "Shipments", permission: "dispatch:view", path: (q) => `/api/dispatch/shipments?search=${q}&pageSize=5`, rows: (data) => data.shipments, show: (row) => ({ title: row.shipmentNumber, text: `${row.customerName ?? ""} · ${String(row.status).toLowerCase()}`, href: `/dispatch/shipments/${row.id}` }), icon: Truck },
  { group: "Items", permission: "products:view", path: (q) => `/api/products?search=${q}&pageSize=5`, rows: (data) => data.products, show: (row) => ({ title: row.sku, text: row.name, href: `/inventory/item-master/${encodeURIComponent(row.id)}` }), icon: Package },
];

const QUICK_PAGES = ["/dashboard", "/finance/invoices", "/finance/invoices/new", "/sales/orders", "/production/orders", "/quality/inspections", "/packing/orders", "/dispatch/shipments"];

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatRole(role = "") {
  return role.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function getJson(path, signal) {
  const response = await fetch(path, { credentials: "include", cache: "no-store", signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || `Request failed (${response.status}).`);
  return payload.data;
}

/* Closes a menu on a click outside it. */
function useOutsideClose(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    function onDown(event) {
      if (ref.current && !ref.current.contains(event.target)) close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [ref, open, close]);
}

export default function Topbar({ onMenuClick }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [attention, setAttention] = useState({ items: [], total: 0, loaded: false });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const createRef = useRef(null);
  const bellRef = useRef(null);
  const profileRef = useRef(null);
  const close = useCallback(() => setOpen(""), []);
  useOutsideClose(createRef, open === "create", close);
  useOutsideClose(bellRef, open === "notifications", close);
  useOutsideClose(profileRef, open === "profile", close);

  const entry = navEntryFor(pathname);
  const permissions = currentUser?.permissions ?? [];
  const can = (permission) => permissions.includes(permission);

  // Menus close when the page changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen("");
  }

  useEffect(() => {
    let active = true;
    getJson("/api/auth/session")
      .then((user) => { if (active) setCurrentUser(user); })
      .catch(() => { if (active) setCurrentUser(null); })
      .finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, []);

  // Waiting work for the bell: on load, every two minutes, and after anything is saved.
  useEffect(() => {
    let active = true;
    const load = () => getJson("/api/attention")
      .then((data) => { if (active) setAttention({ ...data, loaded: true }); })
      .catch(() => { if (active) setAttention((current) => ({ ...current, loaded: true })); });
    load();
    const timer = window.setInterval(load, 120_000);
    window.addEventListener("erp:data-changed", load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("erp:data-changed", load);
    };
  }, []);

  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen("search");
      } else if (event.key === "Escape") {
        setOpen("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(`Sign out failed (${response.status}).`);
      // A full page load drops every cached page and state of the signed-in session.
      window.location.replace("/login");
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Sign out failed. Try again.");
      setSigningOut(false);
    }
  }

  const toggle = (menu) => setOpen((current) => (current === menu ? "" : menu));
  const role = formatRole(currentUser?.roles?.[0] || "USER");
  const actions = QUICK_ACTIONS.filter((action) => can(action.permission));

  return (
    <>
      <header className="erp-topbar">
        <div className="erp-topbar__left">
          <button type="button" className="erp-topbar__menu" onClick={onMenuClick} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <nav className="erp-topbar__context" aria-label="You are here">
            <span className="erp-topbar__section">{entry?.parent ?? entry?.group ?? "AF7 ERP"}</span>
            <span className="erp-topbar__separator">/</span>
            <span className="erp-topbar__title">{entry?.label ?? "Workspace"}</span>
          </nav>
        </div>

        <div className="erp-topbar__right">
          <button type="button" className="erp-topbar__search-trigger" onClick={() => setOpen("search")} aria-label="Search (Ctrl+K)">
            <Search size={17} />
            <span className="erp-topbar__search-text">Search anything</span>
            <span className="erp-topbar__shortcut"><Command size={12} />K</span>
          </button>

          {actions.length > 0 && (
            <div className="erp-topbar__action-wrap" ref={createRef}>
              <button type="button" className="erp-topbar__create" onClick={() => toggle("create")} aria-expanded={open === "create"} aria-haspopup="menu">
                <Plus size={17} />
                <span>New</span>
              </button>
              {open === "create" && (
                <div className="erp-topbar__create-menu" role="menu">
                  <div className="erp-topbar__create-header">
                    <div><strong>Create new</strong><span>Choose an action</span></div>
                    <button type="button" onClick={close} aria-label="Close"><X size={16} /></button>
                  </div>
                  <div className="erp-topbar__create-list">
                    {actions.map(({ icon: Icon, ...action }) => (
                      <Link key={action.label} href={action.href} className="erp-topbar__create-item" role="menuitem" onClick={close}>
                        <span className="erp-topbar__create-icon"><Icon size={17} /></span>
                        <span><strong>{action.label}</strong><small>{action.description}</small></span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="erp-topbar__action-wrap" ref={bellRef}>
            <button type="button" className="erp-topbar__icon-button" onClick={() => toggle("notifications")} aria-expanded={open === "notifications"} aria-label={attention.total ? `${attention.total} items need attention` : "Nothing needs attention"}>
              {attention.total ? <BellRing size={18} /> : <Bell size={18} />}
              {attention.total > 0 && <span className="erp-topbar__notification-dot">{attention.total > 99 ? "99+" : attention.total}</span>}
            </button>
            {open === "notifications" && (
              <div className="erp-topbar__dropdown erp-topbar__dropdown--notifications">
                <div className="erp-topbar__dropdown-header">
                  <div>
                    <strong>Needs attention</strong>
                    <span>{attention.total ? `${attention.total} waiting` : "All clear"}</span>
                  </div>
                  <button type="button" onClick={close} aria-label="Close"><X size={16} /></button>
                </div>
                <div className="erp-topbar__notification-list">
                  {!attention.loaded ? (
                    <div className="erp-topbar__notification-empty">Loading…</div>
                  ) : attention.items.length === 0 ? (
                    <div className="erp-topbar__notification-empty">Nothing is waiting. New work shows here as it comes in.</div>
                  ) : attention.items.map((item) => (
                    <Link key={item.key} href={item.href} className="erp-topbar__notification erp-topbar__attention" onClick={close}>
                      <span className="erp-topbar__attention-count">{item.count}</span>
                      <span className="erp-topbar__attention-label">{item.label}</span>
                      <ChevronRight size={15} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {can("roles:view") && (
            <Link href="/administration/settings" className="erp-topbar__icon-button erp-topbar__settings" aria-label="Settings" title="Settings">
              <Settings size={18} />
            </Link>
          )}

          <div className="erp-topbar__action-wrap" ref={profileRef}>
            <button type="button" className="erp-topbar__profile" onClick={() => toggle("profile")} aria-expanded={open === "profile"} aria-haspopup="menu">
              <span className="erp-topbar__avatar">{sessionLoading ? "…" : getInitials(currentUser?.name)}</span>
              <span className="erp-topbar__profile-copy">
                <strong>{sessionLoading ? "Loading…" : currentUser?.name || "User"}</strong>
                <small>{sessionLoading ? "…" : role}</small>
              </span>
              <ChevronDown size={15} />
            </button>
            {open === "profile" && (
              <div className="erp-topbar__dropdown erp-topbar__dropdown--profile" role="menu">
                <div className="erp-topbar__profile-header">
                  <span className="erp-topbar__avatar erp-topbar__avatar--large">{getInitials(currentUser?.name)}</span>
                  <div>
                    <strong>{currentUser?.name || "User"}</strong>
                    <span>{currentUser?.email || role}</span>
                  </div>
                </div>
                <div className="erp-topbar__profile-links">
                  <Link href="/administration/profile" role="menuitem" onClick={close}>
                    <User size={16} />
                    My profile &amp; password
                  </Link>
                  {can("roles:view") && (
                    <Link href="/administration/settings" role="menuitem" onClick={close}>
                      <Settings size={16} />
                      Company settings
                    </Link>
                  )}
                </div>
                <div className="erp-topbar__profile-footer">
                  <button type="button" role="menuitem" onClick={signOut} disabled={signingOut}>
                    {signingOut ? <Loader2 size={16} className="erp-topbar__spin" /> : <LogOut size={16} />}
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                  {signOutError && <p className="erp-topbar__error" role="alert">{signOutError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {open === "search" && <SearchPanel can={can} onClose={close} onOpen={(href) => { close(); router.push(href); }} />}
    </>
  );
}

/* Search: menu pages by name, and records through the list APIs the user may read. */
function SearchPanel({ can, onClose, onOpen }) {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState({ query: "", groups: [], loading: false });
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const text = query.trim();

  useEffect(() => {
    if (text.length < 2) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRecords((current) => ({ ...current, loading: true }));
      const searches = RECORD_SEARCHES.filter((search) => can(search.permission));
      const settled = await Promise.allSettled(searches.map((search) => getJson(search.path(encodeURIComponent(text)), controller.signal)));
      if (controller.signal.aborted) return;
      const groups = searches.map((search, index) => ({
        group: search.group,
        icon: search.icon,
        items: settled[index].status === "fulfilled" ? (search.rows(settled[index].value) ?? []).slice(0, 5).map(search.show) : [],
      })).filter((group) => group.items.length);
      setRecords({ query: text, groups, loading: false });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // can() is stable for the session; the search reruns when the text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const lower = text.toLowerCase();
  const pages = (text
    ? NAV_PAGES.filter((page) => `${page.label} ${page.parent ?? ""} ${page.group}`.toLowerCase().includes(lower))
    : NAV_PAGES.filter((page) => QUICK_PAGES.includes(page.href))
  ).filter((page, index, list) => list.findIndex((item) => item.href === page.href) === index).slice(0, 8);

  const groups = [
    { group: text ? "Pages" : "Quick access", items: pages.map((page) => ({ title: page.parent ? `${page.parent} · ${page.label}` : page.label, text: page.group, href: page.href, icon: page.icon })) },
    ...(text.length >= 2 && records.query === text ? records.groups.map((group) => ({ ...group, items: group.items.map((item) => ({ ...item, icon: group.icon })) })) : []),
  ].filter((group) => group.items.length);
  const flat = groups.flatMap((group) => group.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  function onKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && flat[current]) {
      event.preventDefault();
      onOpen(flat[current].href);
    }
  }

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const searching = text.length >= 2 && (records.loading || records.query !== text);
  let index = -1;

  return (
    <div className="erp-command" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="erp-command__panel" role="dialog" aria-label="Search">
        <div className="erp-command__search">
          <Search size={19} />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search orders, customers, production, invoices, items…"
            aria-label="Search"
          />
          {searching && <Loader2 size={17} className="erp-topbar__spin" aria-label="Searching" />}
          <button type="button" onClick={onClose}>ESC</button>
        </div>

        <div className="erp-command__body" ref={listRef}>
          {groups.length === 0 ? (
            <p className="erp-command__empty">{searching ? "Searching…" : `Nothing found for “${text}”.`}</p>
          ) : groups.map((group) => (
            <div key={group.group}>
              <div className="erp-command__heading">{group.group}</div>
              <div className="erp-command__items">
                {group.items.map(({ icon: Icon, ...item }) => {
                  index += 1;
                  const mine = index;
                  return (
                    <Link
                      key={`${group.group}-${item.href}-${item.title}`}
                      href={item.href}
                      className={`erp-command__item ${mine === current ? "erp-command__item--active" : ""}`}
                      data-active={mine === current}
                      onMouseEnter={() => setActive(mine)}
                      onClick={(event) => { event.preventDefault(); onOpen(item.href); }}
                    >
                      <span className="erp-command__item-icon">{Icon ? <Icon size={18} /> : <Search size={18} />}</span>
                      <span className="erp-command__item-copy">
                        <strong>{item.title}</strong>
                        {item.text && <small>{item.text}</small>}
                      </span>
                      <CornerDownLeft size={14} className="erp-command__item-arrow" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="erp-command__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
