import { useEffect, useRef, useState } from "react";
import { Form, NavLink, useFetcher, useLocation, useRevalidator } from "react-router";
import {
  FaUserCircle,
  FaUser,
  FaBars,
  FaBell,
} from "react-icons/fa";

interface NotificacionItem {
  id_n: number;
  mensaje: string;
  tipo: string;
  leido?: boolean | number;
  fecha_envio?: string;
}

interface NavbarUserProps {
  nombreUsuario?: string;
  userId?: number;
  notificacionesNoLeidas?: number;
  notificaciones?: NotificacionItem[];
  onToggleSidebar?: () => void;
}

export function NavbarUser({
  nombreUsuario,
  userId,
  notificacionesNoLeidas = 0,
  notificaciones = [],
  onToggleSidebar,
}: NavbarUserProps) {
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const location = useLocation();
  const previousFetcherState = useRef(fetcher.state);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !bellRef.current?.contains(target) &&
        !notificationPanelRef.current?.contains(target)
      ) {
        setBellOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setBellOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const completed = previousFetcherState.current !== "idle" && fetcher.state === "idle";
    previousFetcherState.current = fetcher.state;
    if (completed && (fetcher.data as { ok?: boolean } | undefined)?.ok) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  useEffect(() => {
    setBellOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const marcarLeida = (id_n: number) => {
    if (!userId) return;
    const fd = new FormData();
    fd.append("intent", "marcar-leida");
    fd.append("id_n", String(id_n));
    fetcher.submit(fd, { method: "post", action: "/user/notifs" });
  };

  const marcarTodas = () => {
    if (!userId) return;
    const fd = new FormData();
    fd.append("intent", "marcar-todas-leidas");
    fetcher.submit(fd, { method: "post", action: "/user/notifs" });
  };

  const badgeCount =
    notificacionesNoLeidas > 99 ? "99+" : String(notificacionesNoLeidas);
  const fetcherData = fetcher.data as { ok?: boolean; error?: string } | undefined;
  const notificationError =
    fetcher.state === "idle" && fetcherData?.ok === false
      ? fetcherData.error || "No se pudo actualizar la notificación"
      : null;

  const formatNotificationDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-[#1B6EB6] to-[#1a237e] shadow-lg shadow-blue-900/20">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Abrir menú de navegación"
              className="lg:hidden flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-white/90 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <FaBars size={18} aria-hidden="true" />
            </button>
            <NavLink
              to="/losas"
              onClick={() => {
                setBellOpen(false);
                setProfileOpen(false);
              }}
              className="flex items-center gap-2.5 text-white font-bold text-lg"
            >
              <img
                src="/images/logo.png"
                alt="Logo"
                className="w-8 h-8 rounded-full border-2 border-white/30"
              />
              <span>UNHEVAL</span>
            </NavLink>
          </div>

          <div className="flex items-center gap-1">
            {nombreUsuario && userId && (
              <div className="relative" ref={bellRef}>
                <button
                  type="button"
                  aria-label={bellOpen ? "Cerrar notificaciones" : "Abrir notificaciones"}
                  aria-expanded={bellOpen}
                  aria-controls="panel-notificaciones"
                  onClick={() => setBellOpen((open) => !open)}
                  className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/90 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <FaBell aria-hidden="true" />
                  {notificacionesNoLeidas > 0 && <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{badgeCount}</span>}
                </button>
              </div>
            )}

            {nombreUsuario && userId ? (
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/20">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/10">
                  <FaUserCircle className="text-white" aria-hidden="true" />
                </div>
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    aria-expanded={profileOpen}
                    aria-controls="menu-perfil-usuario"
                    onClick={() => setProfileOpen((open) => !open)}
                    className="flex min-h-11 max-w-48 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    <span className="truncate">{nombreUsuario}</span>
                    <svg
                      className={`w-3 h-3 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {profileOpen && <div id="menu-perfil-usuario" className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-xl)] border border-[var(--border-color)] z-50 overflow-hidden animate-scale-in">
                    <NavLink
                      to="/perfil"
                      onClick={() => setProfileOpen(false)}
                      className="flex min-h-11 items-center px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FaUser className="text-[var(--text-muted)] text-xs" aria-hidden="true" />
                        Perfil
                      </div>
                    </NavLink>
                    <div className="border-t border-[var(--border-color)]" />
                    <Form
                      method="post"
                      action="/logout"
                    >
                      <button
                        type="submit"
                        className="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Cerrar sesión
                        </div>
                      </button>
                    </Form>
                  </div>}
                </div>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all ml-3"
              >
                <FaUser className="text-sm" aria-hidden="true" />
                Iniciar sesión
              </NavLink>
            )}
          </div>
        </div>

        {bellOpen && nombreUsuario && userId && (
          <div ref={notificationPanelRef} id="panel-notificaciones" role="region" aria-label="Notificaciones" className="absolute right-4 top-16 z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[var(--shadow-xl)] animate-scale-in">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] px-4 py-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Notificaciones</span>
              {notificacionesNoLeidas > 0 && (
                <button type="button" disabled={fetcher.state !== "idle"} onClick={marcarTodas} className="min-h-11 rounded-lg px-2 text-xs font-medium text-[var(--color-primary-500)] hover:bg-[var(--bg-surface)] disabled:opacity-50">
                  Marcar todas como leídas
                </button>
              )}
            </div>
            {notificationError && <p role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-700">{notificationError}. Inténtalo nuevamente.</p>}
            <div className="max-h-80 overflow-y-auto">
              {notificaciones.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--text-secondary)]">No hay notificaciones</p>
              ) : (
                notificaciones.slice(0, 10).map((n) => {
                  const leido = Boolean(n.leido);
                  return (
                    <button
                      key={n.id_n}
                      type="button"
                      disabled={leido || fetcher.state !== "idle"}
                      onClick={() => marcarLeida(n.id_n)}
                      className={`min-h-11 w-full border-b border-[var(--border-light)] px-4 py-3 text-left transition-colors hover:bg-[var(--bg-surface)] disabled:cursor-default ${leido ? "opacity-60" : "bg-[var(--color-primary-50)]/50"}`}
                    >
                      <p className="line-clamp-2 text-sm text-[var(--text-primary)]">{n.mensaje}</p>
                      <div className="mt-1.5 flex items-end justify-between gap-3">
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {n.tipo}{n.fecha_envio ? ` · ${formatNotificationDate(n.fecha_envio)}` : ""}
                        </span>
                        {!leido && <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--color-primary-500)] px-1.5 py-0.5 text-[10px] font-medium text-white">Nueva</span>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}