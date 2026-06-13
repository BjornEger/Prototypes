import { NavLink } from "react-router-dom";
import { useUser } from "@/store/UserContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClockClockwise } from "@phosphor-icons/react";

const NAV = [
  { to: "/", label: "Indtast timer", testId: "nav-indtast" },
  { to: "/mine", label: "Mine aktiviteter", testId: "nav-mine" },
  { to: "/overblik", label: "Programoverblik", testId: "nav-overblik" },
  { to: "/admin", label: "Administration", testId: "nav-admin" },
];

export default function Header() {
  const { users, currentUserId, selectUser, currentUser } = useUser();

  return (
    <header
      className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-zinc-200"
      data-testid="app-header"
    >
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-8">
        <div className="flex items-center gap-2 mr-2">
          <ClockClockwise size={22} weight="bold" className="text-zinc-900" />
          <span className="font-outfit font-semibold tracking-tight text-[15px] text-zinc-950">
            Tidsregistrering
          </span>
        </div>

        <nav className="flex items-center gap-1 text-sm" data-testid="main-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testId}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3" data-testid="user-switcher-wrap">
          <span className="hidden md:inline text-xs text-zinc-500 uppercase tracking-wider font-medium">
            Bruger
          </span>
          <Select value={currentUserId || ""} onValueChange={(v) => selectUser(v)}>
            <SelectTrigger
              className="w-[220px] h-9 bg-white border-zinc-200 text-sm"
              data-testid="user-select-trigger"
            >
              <SelectValue placeholder="Vælg bruger…" />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id} data-testid={`user-option-${u.id}`}>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-zinc-500">
                      {u.role === "pmo" ? "PMO" : u.role === "projektleder" ? "PL" : ""}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentUser && (
            <div
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white text-xs font-semibold"
              data-testid="user-initials"
            >
              {currentUser.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
