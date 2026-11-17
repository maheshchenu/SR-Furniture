
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import logo from "../assets/logo2.png";

// Navigation menu items
const menuItems = [
  { name: "Dashboard", path: "/", icon: "▦", group: "Overview" },
  { name: "Categories", path: "/categories", icon: "▤", group: "Inventory" },
  { name: "Products", path: "/products", icon: "▣", group: "Inventory" },
  { name: "Sales", path: "/sales", icon: "↗", group: "Sales & finance" },
  { name: "Customer Dues", path: "/customer-dues", icon: "◷", group: "Sales & finance" },
  { name: "Expenses", path: "/expenses", icon: "₹", group: "Sales & finance" },

  // NEW MENU
  {
    name: "Manufacturer Payments",
    path: "/manufacturer-payments",
    icon: "₹",
    group: "Sales & finance",
  },

  { name: "Reports", path: "/reports", icon: "▥", group: "Insights" },
];

// Sidebar icons
const ICON_PATHS = {
  Dashboard:
    "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z",

  Categories:
    "M3 12V4h8l10 10-8 8L3 12zM7.5 8h.01",

  Products:
    "M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5 12 12.5l8.7-5M12 22V12.5",

  Sales:
    "M3 17l6-6 4 4 8-8M15 7h6v6",

  "Customer Dues":
    "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",

  Expenses:
    "M6 3h12M6 8h12M6 13h3c4 0 6-2 6-5M9 13l7 8",

  "Manufacturer Payments":
    "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",

  Reports:
    "M4 20h16M7 20v-7M12 20V6M17 20v-10",
};

function NavIcon({ item }) {
  const path = ICON_PATHS[item.name];

  if (!path) {
    return (
      <span className="text-lg leading-none">
        {item.icon}
      </span>
    );
  }

  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

// Group consecutive menu items
const menuGroups = menuItems.reduce((groups, item) => {
  const last = groups[groups.length - 1];

  if (last && last.name === item.group) {
    last.items.push(item);
  } else {
    groups.push({
      name: item.group,
      items: [item],
    });
  }

  return groups;
}, []);

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  // Close mobile sidebar with Escape key
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between bg-[linear-gradient(135deg,#001F0B_0%,#003B16_100%)] px-5 py-3 text-[#FFFDF5] shadow-[0_10px_30px_-10px_rgba(0,31,11,0.7)] lg:hidden">
        <img
          src={logo}
          alt="SR Furniture Logo"
          className="h-16 w-auto max-w-[190px] object-contain"
        />

        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DFA900]/40 bg-white/5 text-2xl text-[#FFD75A] transition duration-200 hover:bg-[#DFA900]/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DFA900]/30 active:scale-95"
        >
          {isOpen ? "✕" : "☰"}
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-[#9B7136] via-[#FFD75A] to-[#9B7136]" />
      </header>

      {/* Mobile Overlay */}
      <div
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-[#001F0B]/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-72 max-w-[85vw] flex-col overflow-hidden bg-[linear-gradient(180deg,#001F0B_0%,#003B16_55%,#00290F_100%)] text-[#FFFDF5] shadow-[12px_0_40px_-12px_rgba(0,31,11,0.6)] transition-[transform,visibility] duration-300 ease-out lg:w-64 lg:max-w-none lg:translate-x-0 lg:visible ${
          isOpen
            ? "visible translate-x-0"
            : "invisible -translate-x-full"
        }`}
      >
        {/* Decorative elements */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full border-[30px] border-white/[0.04]" />

        <div className="pointer-events-none absolute -bottom-28 -left-24 h-64 w-64 rounded-full border-[26px] border-[#FFD75A]/[0.06]" />

        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[#DFA900]/50 to-transparent" />

        <div className="relative flex min-h-0 flex-1 flex-col px-4 py-6">
          {/* Desktop Logo */}
          <div className="mb-6 hidden lg:block">
            <div className="rounded-2xl border border-[#DFA900]/30 bg-white/[0.04] p-4 shadow-lg backdrop-blur-sm">
              <img
                src={logo}
                alt="SR Furniture Logo"
                className="mx-auto h-28 w-auto max-w-full object-contain drop-shadow-[0_6px_14px_rgba(223,169,0,0.25)]"
              />
            </div>

            <p className="mt-3 text-center text-xs font-semibold tracking-[0.18em] text-[#FFD75A]">
              SR FURNITURE MANAGEMENT
            </p>

            <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-[#DFA900] to-transparent" />
          </div>

          {/* Mobile Menu Title */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <p className="text-lg font-bold text-[#FFD75A]">
              Menu
            </p>

            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DFA900]/30"
            >
              ✕
            </button>
          </div>

          {/* Navigation */}
          <nav
            aria-label="Main navigation"
            className="-mr-2 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2 [scrollbar-color:rgba(223,169,0,0.35)_transparent] [scrollbar-width:thin]"
          >
            {menuGroups.map((group) => (
              <div key={group.name}>
                <div className="mb-2 flex items-center gap-3 px-3">
                  <p className="text-[11px] font-bold tracking-[0.16em] text-[#FFD75A]/70">
                    {group.name}
                  </p>

                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/"}
                      onClick={() => setIsOpen(false)}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[15px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DFA900]/30 ${
                          isActive
                            ? "bg-gradient-to-r from-[#FFD75A] to-[#DFA900] font-extrabold text-[#001F0B] shadow-[0_10px_24px_-10px_rgba(223,169,0,0.7)]"
                            : "font-medium text-[#FFFDF5]/85 hover:translate-x-1 hover:bg-white/10 hover:text-[#FFD75A]"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                              isActive
                                ? "bg-[#001F0B]/15 text-[#001F0B]"
                                : "bg-white/[0.06] text-[#FFD75A] group-hover:scale-110 group-hover:bg-[#DFA900]/20"
                            }`}
                          >
                            <NavIcon item={item} />
                          </span>

                          <span className="truncate">
                            {item.name}
                          </span>

                          {isActive && (
                            <span className="ml-auto h-2 w-2 rounded-full bg-[#001F0B]/70" />
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="mt-5 shrink-0 overflow-hidden rounded-2xl border border-[#DFA900]/30 bg-[#001F0B]/70 shadow-lg backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-[#9B7136] via-[#FFD75A] to-[#9B7136]" />

            <div className="p-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFD75A] opacity-50" />

                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FFD75A]" />
                </span>

                <p className="text-sm font-bold text-[#FFD75A]">
                  SR Furniture
                </p>
              </div>

              <p className="mt-1.5 text-xs leading-relaxed text-[#FFFDF5]/70">
                Manage your furniture business
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
