import { Form, NavLink } from "react-router";
import {
  FaFutbol,
  FaClock,
  FaFileAlt,
  FaUserCircle,
  FaSignOutAlt,
  FaTimes,
} from "react-icons/fa";

interface SidebarUserProps {
  nombre?: string;
  onClose?: () => void;
}

const navItems = [
  { to: "/losas", icon: FaFutbol, label: "Losas" },
  { to: "/horario", icon: FaClock, label: "Horarios" },
  { to: "/permiso", icon: FaFileAlt, label: "Mis permisos" },
];

export function SidebarUser({ nombre = "Usuario", onClose }: SidebarUserProps) {
  return (
    <nav className="sidebar h-full flex flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/images/logo.png"
            alt="Logo UNHEVAL"
            className="w-9 h-9 shrink-0 rounded-full bg-white p-0.5 object-contain"
          />
          <div className="min-w-0">
            <p className="text-white text-sm font-bold truncate">UNHEVAL</p>
            <p className="text-gray-400 text-[10px] truncate">Losas deportivas</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
          className="lg:hidden flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          <FaTimes aria-hidden="true" />
        </button>
      </div>

      {/* Profile */}
      <div className="text-center py-5 px-4 border-b border-white/[0.07]">
        <div className="w-14 h-14 mx-auto mb-2.5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-blue-500/20 ring-2 ring-white/10">
          {nombre.charAt(0).toUpperCase()}
        </div>
        <h5 className="text-white text-sm font-semibold truncate px-2">{nombre}</h5>
        <span className="inline-block mt-1 px-2.5 py-0.5 bg-blue-500/15 text-blue-300 text-[10px] font-medium rounded-full">
          Usuario
        </span>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `sidebar-nav-item flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                isActive
                  ? "sidebar-nav-item active bg-blue-600/20 text-white font-medium"
                  : "text-gray-400/90 hover:text-white hover:bg-white/[0.06]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`text-sm transition-all duration-200 ${isActive ? "scale-110 text-blue-400" : "opacity-70"}`} />
                <span>{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/[0.07] space-y-0.5">
        <NavLink
          to="/perfil"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl text-gray-400/90 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
        >
          <FaUserCircle className="text-sm opacity-70" aria-hidden="true" />
          Mi perfil
        </NavLink>
        <Form method="post" action="/logout">
          <button
            type="submit"
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
          >
            <FaSignOutAlt className="text-sm" aria-hidden="true" />
            Cerrar sesión
          </button>
        </Form>
        <p className="text-[10px] text-gray-500 text-center pt-3">
          UNHEVAL © {new Date().getFullYear()}
        </p>
      </div>
    </nav>
  );
}