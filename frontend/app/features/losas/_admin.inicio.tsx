import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { Badge } from "~/shared/components/ui";
import { FaKey, FaShieldAlt, FaUserTie, FaThLarge, FaGraduationCap, FaBell, FaBriefcase, FaCog, FaChartBar, FaRocket, FaImages, FaArrowRight } from "react-icons/fa";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");

  const [usuarios, trabajadores, losas, permisosPendientes] = await Promise.all([
    api.get("/users", request).catch(() => []),
    api.get("/trabajadores", request).catch(() => []),
    api.get("/losas", request).catch(() => []),
    api.get("/permisos?estado=Pendiente", request).catch(() => []),
  ]).then((results) =>
    results.map((r) => {
      if (Array.isArray(r)) return r.length;
      if (r && typeof r === "object" && "data" in r && Array.isArray((r as { data: unknown[] }).data)) {
        return (r as { data: unknown[] }).data.length;
      }
      return 0;
    })
  );

  return data({ totalUsuarios: usuarios, totalTrabajadores: trabajadores, totalLosas: losas, permisosPendientes });
}

const menuItems = [
  { title: "Permisos", icon: FaKey, route: "/dashboard/permisos", gradient: "from-blue-600 to-blue-800", desc: "Gestión de solicitudes", hasBadge: true },
  { title: "Detalle Permisos", icon: FaShieldAlt, route: "/dashboard/detalle-permisos", gradient: "from-rose-500 to-red-600", desc: "Ver reservas detalladas" },
  { title: "Usuarios", icon: FaUserTie, route: "/dashboard/usuarios", gradient: "from-sky-500 to-blue-600", desc: "Alumnos, docentes y personal" },
  { title: "Losas", icon: FaThLarge, route: "/dashboard/losas", gradient: "from-emerald-500 to-teal-600", desc: "Gestión de espacios deportivos" },
  { title: "Disciplinas", icon: FaGraduationCap, route: "/dashboard/disciplinas", gradient: "from-amber-500 to-orange-600", desc: "Deportes y categorías" },
  { title: "Notificaciones", icon: FaBell, route: "/dashboard/notificacion", gradient: "from-teal-500 to-cyan-600", desc: "Alertas del sistema" },
  { title: "Trabajadores", icon: FaBriefcase, route: "/dashboard/trabajadores", gradient: "from-slate-700 to-slate-900", desc: "Personal del sistema" },
  { title: "Imágenes", icon: FaImages, route: "/dashboard/imagenes", gradient: "from-blue-500 to-indigo-600", desc: "Galería y multimedia" },
  { title: "Configuración", icon: FaCog, route: "/dashboard/configuracion", gradient: "from-slate-600 to-gray-700", desc: "Ajustes del sistema" },
];

function DashboardStats({ totalUsuarios, totalTrabajadores, totalLosas, permisosPendientes }: {
  totalUsuarios: number;
  totalTrabajadores: number;
  totalLosas: number;
  permisosPendientes: number;
}) {
  const stats = [
    { label: "Usuarios Registrados", value: totalUsuarios, icon: FaUserTie, color: "text-[var(--color-primary-600)]", bg: "bg-[var(--color-primary-50)]" },
    { label: "Trabajadores Activos", value: totalTrabajadores, icon: FaBriefcase, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Losas Deportivas", value: totalLosas, icon: FaThLarge, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Permisos Pendientes", value: permisosPendientes, icon: FaBell, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="card-theme p-6">
      <div className="flex items-center gap-2 mb-6">
        <FaRocket className="text-[var(--color-primary-500)]" />
        <h3 className="font-bold text-[var(--text-primary)] text-lg">Resumen General del Sistema</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="relative bg-[var(--bg-surface)] rounded-2xl p-5 text-center border border-[var(--border-color)] hover-lift cursor-default"
          >
            <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
              <stat.icon className={`${stat.color}`} size={18} />
            </div>
            <span className="block text-2xl font-bold text-[var(--text-primary)] tabular-nums">{stat.value}</span>
            <span className="text-xs text-[var(--text-secondary)] font-medium">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminInicio() {
  const { totalUsuarios, totalTrabajadores, totalLosas, permisosPendientes } = useLoaderData<typeof loader>();

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3.5 bg-gradient-to-br from-[var(--color-primary-50)] to-blue-100 rounded-2xl shadow-sm text-[var(--color-primary-500)]">
          <FaChartBar size={24} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-theme-primary">Panel de Control Principal</h1>
          <p className="text-sm text-[var(--text-secondary)]">Acceso rápido a los módulos administrativos y métricas en tiempo real.</p>
        </div>
      </div>

      {/* Navigation cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
        {menuItems.map((item) => (
          <Link
            key={item.route}
            to={item.route}
            aria-label={`Acceder al módulo de ${item.title}`}
            className={`bg-gradient-to-br ${item.gradient} rounded-2xl p-6 text-white min-h-[170px] flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl`}
          >
            {/* Decorative background blobs */}
            <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/[0.08] rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/[0.05] rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
            <div className="absolute top-1/3 -right-12 w-36 h-36 bg-white/[0.04] rounded-full blur-xl" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-all duration-300">
                <item.icon size={20} />
              </div>
              <div className="flex items-center gap-2">
                {item.hasBadge && permisosPendientes > 0 && (
                  <span className="bg-amber-400 text-slate-900 text-xs font-extrabold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                    {permisosPendientes} pendientes
                  </span>
                )}
                <span className="text-white/50 text-xs group-hover:text-white transition-colors">
                  <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
            <div className="relative z-10 mt-4">
              <h2 className="font-bold text-lg mb-1">{item.title}</h2>
              <p className="text-xs text-white/80 font-normal">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <DashboardStats
        totalUsuarios={totalUsuarios}
        totalTrabajadores={totalTrabajadores}
        totalLosas={totalLosas}
        permisosPendientes={permisosPendientes}
      />
    </div>
  );
}
