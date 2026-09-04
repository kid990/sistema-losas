import { NavLink } from "react-router";
import { FaHome, FaKey, FaShieldAlt, FaUserTie, FaThLarge, FaGraduationCap, FaBell, FaBriefcase, FaImages, FaCog } from "react-icons/fa";

interface SidebarProps {
  nombre?: string;
  rol?: string;
}

const navItems = [
  { to: "/dashboard/inicio", icon: FaHome, label: "Inicio" },
  { to: "/dashboard/permisos", icon: FaKey, label: "Permisos" },
  { to: "/dashboard/detalle-permisos", icon: FaShieldAlt, label: "Detalle Permisos" },
  { to: "/dashboard/usuarios", icon: FaUserTie, label: "Usuarios" },
  { to: "/dashboard/disciplinas", icon: FaGraduationCap, label: "Disciplinas" },
  { to: "/dashboard/losas", icon: FaThLarge, label: "Losas" },
  { to: "/dashboard/notificacion", icon: FaBell, label: "Notificaciones" },
  { to: "/dashboard/trabajadores", icon: FaBriefcase, label: "Trabajadores" },
  { to: "/dashboard/imagenes", icon: FaImages, label: "Imágenes" },
  { to: "/dashboard/configuracion", icon: FaCog, label: "Configuración" },
];

export function Sidebar({ nombre = "Administrador", rol = "Administrador" }: SidebarProps) {
  return (
    <nav className="sidebar h-full flex flex-col text-white">
      {/* Profile */}
      <div className="text-center py-7 px-4 border-b border-white/[0.07]">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20 ring-2 ring-white/10">
          {nombre.charAt(0).toUpperCase()}
        </div>
        <h5 className="text-white text-sm font-semibold mb-0.5 truncate px-2">{nombre}</h5>
        <span className="inline-block px-2.5 py-0.5 bg-blue-500/15 text-blue-300 text-[10px] font-medium rounded-full">
          {rol}
        </span>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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
                <span className="nav-label">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/[0.07]">
        <p className="text-[10px] text-gray-500 text-center">
          UNHEVAL © {new Date().getFullYear()}
        </p>
      </div>
    </nav>
  );
}
