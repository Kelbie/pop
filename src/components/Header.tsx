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
    <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo-dark.jpeg"
            alt="Pop logo"
            className="h-8 w-8 rounded-lg"
          />
          <span className="text-lg font-bold tracking-tight text-neutral-100">
            Pop
          </span>
        </Link>

        {authed ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 py-1 pl-1 pr-3 transition hover:border-neutral-700"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="max-w-[10rem] truncate text-sm text-neutral-200">
                {displayName}
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 py-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-neutral-300 transition hover:bg-neutral-800"
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
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting…" : "Log in"}
          </button>
        )}
      </div>
    </header>
  );
}
