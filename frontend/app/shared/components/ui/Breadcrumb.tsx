import { useLocation, Link } from "react-router";
import { FaChevronRight, FaHome } from "react-icons/fa";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  inicio: "Inicio",
  usuarios: "Usuarios",
  permisos: "Permisos",
  "detalle-permisos": "Detalle de Permisos",
  trabajadores: "Trabajadores",
  losas: "Losas Deportivas",
  disciplinas: "Disciplinas",
  imagenes: "Galería de Imágenes",
  configuracion: "Configuración",
  "revision-ia": "Revisión automática",
  reportes: "Reportes",
  notificacion: "Notificaciones",
  perfil: "Mi Perfil",
  seguridad: "Seguridad",
  modulo: "Control de Garita",
  horario: "Horarios y Reservas",
  permiso: "Mis Permisos",
  user: "Usuario",
  notifs: "Notificaciones",
};

interface BreadcrumbProps {
  className?: string;
  customItems?: { label: string; to?: string }[];
}

export function Breadcrumb({ className = "", customItems }: BreadcrumbProps) {
  const location = useLocation();

  let items: { label: string; to?: string }[] = [];

  if (customItems && customItems.length > 0) {
    items = customItems;
  } else {
    const pathnames = location.pathname.split("/").filter((x) => x);

    // Build base root link depending on the section
    const rootPath = pathnames[0] === "dashboard" 
      ? "/dashboard/inicio" 
      : pathnames[0] === "seguridad"
      ? "/seguridad/modulo"
      : "/losas";

    items.push({
      label: "Inicio",
      to: rootPath,
    });

    let currentPath = "";
    pathnames.forEach((segment, index) => {
      currentPath += `/${segment}`;
      // Avoid duplicating each section's route used as its home.
      if (
        segment === "dashboard" ||
        (segment === "inicio" && index === 1) ||
        (segment === "losas" && index === 0)
      ) {
        return;
      }
      if (segment === "seguridad" && pathnames.length > 1) {
        return;
      }

      const label = ROUTE_LABELS[segment] || decodeURIComponent(segment.replace(/-/g, " "));
      const isLast = index === pathnames.length - 1;

      items.push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        to: isLast ? undefined : currentPath,
      });
    });
  }

  return (
    <nav
      aria-label="Migas de pan"
      className={`flex items-center text-xs font-medium text-[var(--text-secondary)] mb-4 ${className}`}
    >
      <ol className="inline-flex items-center space-x-1.5 md:space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.to ?? "current"}-${item.label}`} className="inline-flex items-center">
              {index > 0 && (
                <FaChevronRight
                  className="w-2.5 h-2.5 mx-1.5 text-[var(--text-muted)] shrink-0"
                  aria-hidden="true"
                />
              )}
              {index === 0 && (
                <FaHome className="w-3 h-3 mr-1.5 text-[var(--color-primary-500)]" aria-hidden="true" />
              )}
              {isLast || !item.to ? (
                <span
                  className="text-[var(--text-primary)] font-semibold truncate max-w-[200px]"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="hover:text-[var(--color-primary-500)] transition-colors inline-flex items-center"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
