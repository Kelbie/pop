import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { shortNpub } from "../lib/pubkey";

interface HeaderProps {
  onLoginClick: () => void;
}

export function Header({ onLoginClick }: HeaderProps) {
  const status = useAuthStore((s) => s.status);
  const pubkey = useAuthStore((s) => s.pubkey);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const authed = status === "authenticated" && pubkey;
  const displayName =
    profile?.displayName || profile?.name || (pubkey ? shortNpub(pubkey) : "");
  const avatar = profile?.picture || profile?.image;

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-polaroid/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo-dark.jpeg"
            alt="Pop logo"
            className="h-8 w-8 rounded-lg"
          />
          <span className="text-xl font-light tracking-tight text-ink">
            Pop
          </span>
        </Link>

        {authed ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-hairline bg-polaroid py-1 pl-1 pr-3 transition hover:border-muted"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-avatar text-xs font-semibold text-avatar-ink">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="max-w-[10rem] truncate text-sm text-ink">
                {displayName}
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-hairline bg-polaroid py-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-ink transition hover:bg-paper"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onLoginClick}
            disabled={status === "connecting"}
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-polaroid transition hover:bg-avatar-ink disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting…" : "Log in"}
          </button>
        )}
      </div>
    </header>
  );
}
