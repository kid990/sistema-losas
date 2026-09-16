import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Link, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getUser } from "~/services/auth.server";
import { ROLES } from "~/shared/types/roles";
import {
  FaBell,
  FaBook,
  FaCalendarCheck,
  FaCheckCircle,
  FaClock,
  FaExternalLinkAlt,
  FaFileSignature,
  FaFutbol,
  FaHome,
  FaIdCard,
  FaListOl,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaThLarge,
  FaUniversity,
  FaUserCheck,
} from "react-icons/fa";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) {
    if (user.tipo === ROLES.ADMIN.tipo && user.rol === ROLES.ADMIN.rol) {
      throw redirect("/dashboard/inicio");
    }
    if (
      user.tipo === ROLES.SEGURIDAD.tipo &&
      user.rol === ROLES.SEGURIDAD.rol
    ) {
      throw redirect("/seguridad/modulo");
    }
    throw redirect("/inicio");
  }
  return null;
}

const PASOS_RESERVA = [
  {
    id: "identificate",
    numero: "1",
    titulo: "Ingresa con tu cuenta",
    descripcion:
      "Accede con tus credenciales institucionales para iniciar una solicitud.",
    resultado: "Identidad validada",
    icon: FaUserCheck,
  },
  {
    id: "elige",
    numero: "2",
    titulo: "Elige losa y horario",
    descripcion:
      "Consulta los bloques disponibles y selecciona el espacio que necesitas.",
    resultado: "Bloque disponible",
    icon: FaClock,
  },
  {
    id: "presenta",
    numero: "3",
    titulo: "Presenta tu permiso",
    descripcion:
      "Revisa el estado de la solicitud y muestra el permiso autorizado en garita.",
    resultado: "Ingreso autorizado",
    icon: FaIdCard,
  },
];

const SERVICIOS_SISTEMA = [
  {
    id: "reservas",
    nombre: "Reservas y permisos digitales",
    descripcion:
      "Solicita el uso de una losa sin trámites presenciales y conserva el seguimiento de cada permiso.",
    icon: FaCalendarCheck,
  },
  {
    id: "disponibilidad",
    nombre: "Disponibilidad organizada",
    descripcion:
      "Consulta campos, disciplinas y bloques horarios antes de enviar una solicitud.",
    icon: FaFutbol,
  },
  {
    id: "control",
    nombre: "Verificación en garita",
    descripcion:
      "El personal de seguridad puede comprobar los datos de un permiso autorizado para el ingreso.",
    icon: FaShieldAlt,
  },
  {
    id: "tipos-permiso",
    nombre: "Permisos normales y especiales",
    descripcion:
      "Gestiona solicitudes regulares y actividades especiales con documentación para revisión administrativa.",
    icon: FaFileSignature,
  },
  {
    id: "notificaciones",
    nombre: "Seguimiento y notificaciones",
    descripcion:
      "Recibe información sobre el estado del permiso y las comunicaciones relacionadas con tu solicitud.",
    icon: FaBell,
  },
];

type NormativaTab = "prioridad" | "requisitos" | "sanciones";

const NORMATIVA_TABS: Array<{
  id: NormativaTab;
  label: string;
  titulo: string;
  descripcion: string;
  puntos: string[];
  icon: typeof FaBook;
}> = [
  {
    id: "prioridad",
    label: "Uso y prioridad",
    titulo: "Prioridad y turnos de uso",
    descripcion:
      "Tienen atención preferente los estudiantes matriculados, docentes y delegaciones oficiales de las facultades para actividades universitarias programadas.",
    puntos: [
      "Estudiantes y docentes",
      "Delegaciones oficiales",
      "Actividades universitarias programadas",
    ],
    icon: FaBook,
  },
  {
    id: "requisitos",
    label: "Requisitos",
    titulo: "Identificación y acreditación",
    descripcion:
      "Para ingresar debes presentar el permiso digital autorizado junto con tu DNI o carné universitario al personal de seguridad.",
    puntos: [
      "Permiso digital autorizado",
      "DNI o carné universitario",
      "Verificación con seguridad",
    ],
    icon: FaFileSignature,
  },
  {
    id: "sanciones",
    label: "Cuidado",
    titulo: "Cuidado de la infraestructura",
    descripcion:
      "Utiliza calzado adecuado, conserva limpio el espacio y respeta las condiciones de uso de las instalaciones deportivas.",
    puntos: [
      "Calzado adecuado",
      "Cuidado del espacio deportivo",
      "Respeto de las condiciones de uso",
    ],
    icon: FaShieldAlt,
  },
];

const TAB_IDS = NORMATIVA_TABS.map((tab) => tab.id);

export default function Home() {
  const [activeTab, setActiveTab] = useState<NormativaTab>("prioridad");

  const selectTab = (event: MouseEvent<HTMLButtonElement>) => {
    setActiveTab(event.currentTarget.dataset.tab as NormativaTab);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentTab = event.currentTarget.dataset.tab as NormativaTab;
    const currentIndex = TAB_IDS.indexOf(currentTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      nextIndex = (currentIndex + 1) % TAB_IDS.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TAB_IDS.length - 1;

    if (nextIndex === currentIndex) return;

    event.preventDefault();
    const nextTab = TAB_IDS[nextIndex];
    setActiveTab(nextTab);
    document.getElementById(`tab-${nextTab}`)?.focus();
  };

  const activeNormativa =
    NORMATIVA_TABS.find((tab) => tab.id === activeTab) ?? NORMATIVA_TABS[0];
  const ActiveNormativaIcon = activeNormativa.icon;
  const [featuredService, ...secondaryServices] = SERVICIOS_SISTEMA;
  const FeaturedServiceIcon = featuredService.icon;
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen overflow-x-clip bg-white font-sans text-slate-900 selection:bg-[var(--color-primary-500)] selection:text-white">
      <a
        href="#contenido-principal"
        className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-lg bg-white px-4 py-3 font-bold text-[var(--color-unheval-navy)] shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] motion-reduce:transition-none"
      >
        Ir al contenido principal
      </a>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="hidden bg-[var(--color-primary-500)] text-white sm:block">
          <div className="mx-auto flex min-h-10 max-w-[1320px] items-center justify-between px-6 py-2 text-xs font-semibold">
            <span>Universidad Nacional Hermilio Valdizán</span>
            <a
              href="https://unheval.edu.pe/portal/"
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir el portal institucional de la UNHEVAL en una pestaña nueva"
              className="inline-flex min-h-8 items-center rounded px-2 text-blue-50 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
            >
              Portal institucional ↗
            </a>
          </div>
        </div>

        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-3 px-4 sm:h-20 sm:px-6">
          <Link
            to="/"
            aria-label="Ir al inicio del Sistema de Losas UNHEVAL"
            className="flex min-w-0 items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:ring-offset-2 sm:gap-3"
          >
            <img
              src="/images/logo.png"
              alt=""
              width={48}
              height={48}
              className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-white p-1 object-contain sm:h-12 sm:w-12"
            />
            <span className="min-w-0">
              <span className="hidden truncate text-base font-extrabold tracking-[-0.02em] text-[var(--color-unheval-navy)] sm:block">
                Sistema de Losas Deportivas
              </span>
              <span className="hidden truncate text-xs font-medium text-[var(--color-primary-600)] md:block">
                Permisos y reservas UNHEVAL
              </span>
            </span>
          </Link>

          <Link
            to="/login"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[var(--color-primary-500)] px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:ring-offset-2 active:scale-[0.97] motion-reduce:transform-none sm:px-4"
          >
            <FaUserCheck aria-hidden="true" />
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main id="contenido-principal" tabIndex={-1}>
        <section className="relative overflow-hidden bg-[#f7f9fc] px-4 py-8 sm:px-6 sm:py-12 lg:py-14">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] bg-[var(--color-primary-50)] lg:block" />
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="animate-fade-in-up motion-reduce:animate-none lg:col-span-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary-200)] bg-white px-3.5 py-1.5 text-xs font-bold text-[var(--color-primary-700)] shadow-sm">
                <FaUniversity aria-hidden="true" />
                Servicio institucional UNHEVAL
              </div>

              <h1 className="mt-6 max-w-3xl font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] text-[var(--color-unheval-navy)] min-[400px]:text-4xl sm:text-5xl lg:text-[3.35rem]">
                Reserva losas deportivas de forma
                <span className="text-[var(--color-primary-500)]"> clara y segura</span>
              </h1>

              <p className="mt-5 max-w-[62ch] text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Consulta horarios, solicita tu permiso digital y presenta la
                autorización para ingresar a las instalaciones deportivas de la
                UNHEVAL.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#como-funciona"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-primary-300)] bg-white px-6 py-3.5 text-sm font-bold text-[var(--color-primary-700)] transition-colors hover:bg-[var(--color-primary-50)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:ring-offset-2 active:scale-[0.97] motion-reduce:transform-none sm:px-7"
                >
                  Conocer el proceso
                </a>
              </div>

              <ul className="mt-8 flex flex-col gap-3 border-t border-[var(--color-primary-200)] pt-6 text-sm font-semibold text-slate-700 sm:flex-row sm:gap-8" role="list">
                <li className="flex items-center gap-2.5">
                  <FaCheckCircle className="text-emerald-600" aria-hidden="true" />
                  Horarios por bloque
                </li>
                <li className="flex items-center gap-2.5">
                  <FaCheckCircle className="text-emerald-600" aria-hidden="true" />
                  Permiso digital verificable
                </li>
              </ul>
            </div>

            <figure className="w-full overflow-hidden rounded-2xl bg-[var(--color-unheval-navy)] shadow-xl lg:col-span-7 lg:max-w-[660px] lg:justify-self-end">
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src="/images/unheval.png"
                  alt="Vista aérea del campus de la Universidad Nacional Hermilio Valdizán y sus espacios deportivos"
                  width={1676}
                  height={941}
                  fetchPriority="high"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <div className="absolute right-4 top-4 rounded-xl bg-[var(--color-unheval-navy)]/90 px-4 py-3 text-right text-white shadow-lg">
                  <span className="block text-xs font-medium text-blue-100">Acceso institucional</span>
                  <span className="mt-0.5 block text-sm font-bold">Permiso digital</span>
                </div>
              </div>
              <figcaption className="flex flex-col gap-3 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <span className="font-bold">Infraestructura deportiva UNHEVAL</span>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-100">
                  <FaMapMarkerAlt aria-hidden="true" />
                  Campus universitario, Pillco Marca
                </span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-40 overflow-hidden bg-white px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid items-end gap-8 border-b border-slate-200 pb-10 lg:grid-cols-[1fr_0.62fr]">
              <div>
                <p className="mb-4 flex items-center gap-3 text-sm font-bold text-[var(--color-primary-700)]">
                  <span className="h-px w-10 bg-[var(--color-primary-500)]" aria-hidden="true" />
                  Un recorrido sin trámites innecesarios
                </p>
                <h2 className="max-w-[18ch] text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] text-[var(--color-unheval-navy)] min-[400px]:text-4xl sm:text-5xl">
                  De la elección de la losa al ingreso autorizado
                </h2>
              </div>
              <p className="max-w-[58ch] text-base leading-7 text-slate-600 lg:justify-self-end lg:text-lg lg:leading-8">
                El sistema concentra cada etapa en un mismo recorrido para que puedas
                consultar, solicitar y presentar tu permiso sin perder el seguimiento.
              </p>
            </div>

            <ol className="relative grid lg:grid-cols-3" aria-label="Proceso de reserva">
              {PASOS_RESERVA.map((paso) => {
                const Icon = paso.icon;
                return (
                  <li key={paso.id} className="group relative border-b border-slate-200 py-9 last:border-b-0 lg:border-b-0 lg:border-r lg:px-8 lg:py-12 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0 lg:before:absolute lg:before:left-0 lg:before:right-0 lg:before:top-[5rem] lg:before:h-px lg:before:bg-[var(--color-primary-200)] lg:before:content-['']">
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-unheval-navy)] text-2xl text-white shadow-lg transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="bg-white pl-4 text-5xl font-black tracking-[-0.04em] text-[var(--color-primary-100)]">
                        {paso.numero.padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-7 text-xl font-extrabold text-slate-900">{paso.titulo}</h3>
                    <p className="mt-3 max-w-[38ch] text-sm leading-6 text-slate-600">{paso.descripcion}</p>
                    <p className="mt-6 flex items-center gap-2 text-xs font-bold text-[var(--color-primary-700)]">
                      <FaCheckCircle className="text-emerald-600" aria-hidden="true" />
                      {paso.resultado}
                    </p>
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 grid overflow-hidden rounded-2xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] sm:grid-cols-2">
              <div className="flex gap-4 p-6 sm:p-7">
                <FaCalendarCheck className="mt-1 shrink-0 text-xl text-[var(--color-primary-600)]" aria-hidden="true" />
                <div>
                  <p className="font-extrabold text-[var(--color-unheval-navy)]">Permiso normal</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Reserva regular con flujo directo según disponibilidad.</p>
                </div>
              </div>
              <div className="flex gap-4 border-t border-[var(--color-primary-100)] p-6 sm:border-l sm:border-t-0 sm:p-7">
                <FaFileSignature className="mt-1 shrink-0 text-xl text-[var(--color-primary-600)]" aria-hidden="true" />
                <div>
                  <p className="font-extrabold text-[var(--color-unheval-navy)]">Permiso especial</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Solicitud documentada para actividades que requieren revisión.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="servicios" className="relative scroll-mt-40 overflow-hidden bg-[var(--color-unheval-navy)] px-4 py-16 text-white sm:px-6 lg:py-24">
          <div className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full border-[72px] border-white/[0.035]" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-40 left-[12%] h-80 w-80 rounded-full border-[56px] border-sky-300/[0.04]" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1240px]">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <h2 className="max-w-[15ch] text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] min-[400px]:text-4xl sm:text-5xl">
                Todo el proceso deportivo, conectado
              </h2>
              <p className="max-w-[64ch] text-base leading-7 text-blue-100 lg:justify-self-end lg:text-lg lg:leading-8">
                Estudiantes, docentes, administración y seguridad trabajan con la
                misma información, desde la disponibilidad hasta la verificación en garita.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <article className="relative overflow-hidden rounded-2xl bg-[var(--color-primary-500)] p-7 shadow-xl sm:p-10">
                <div className="absolute -right-10 -top-10 text-[11rem] text-white/[0.07]" aria-hidden="true">
                  <FeaturedServiceIcon />
                </div>
                <div className="relative">
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-2xl text-[var(--color-primary-600)] shadow-md">
                    <FeaturedServiceIcon aria-hidden="true" />
                  </span>
                  <h3 className="mt-10 max-w-[14ch] text-3xl font-extrabold leading-tight sm:text-4xl">{featuredService.nombre}</h3>
                  <p className="mt-4 max-w-[52ch] text-base leading-7 text-blue-50">{featuredService.descripcion}</p>
                  <div className="mt-10 grid grid-cols-3 border-t border-white/25 pt-6 text-xs font-bold text-white min-[400px]:text-sm">
                    <span>Consulta</span>
                    <span className="border-l border-white/25 pl-4 sm:pl-6">Solicita</span>
                    <span className="border-l border-white/25 pl-4 sm:pl-6">Verifica</span>
                  </div>
                </div>
              </article>

              <div className="divide-y divide-white/15 border-y border-white/20">
                {secondaryServices.map((servicio) => {
                  const Icon = servicio.icon;
                  return (
                    <article key={servicio.id} className="group grid gap-4 py-5 sm:grid-cols-[3.5rem_1fr] sm:py-6">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-xl text-sky-200 transition-colors group-hover:bg-white group-hover:text-[var(--color-primary-600)]">
                        <Icon aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-lg font-extrabold text-white">{servicio.nombre}</h3>
                        <p className="mt-1.5 max-w-[60ch] text-sm leading-6 text-blue-100">{servicio.descripcion}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="normativa" className="scroll-mt-40 bg-[#f3f7fb] px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <h2 className="max-w-[17ch] text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] text-[var(--color-unheval-navy)] min-[400px]:text-4xl sm:text-5xl">
                Condiciones claras antes de reservar
              </h2>
              <div className="lg:justify-self-end">
                <p className="max-w-[60ch] text-base leading-7 text-slate-600 lg:text-lg lg:leading-8">
                  Conoce los criterios principales para presentar tu solicitud y usar
                  responsablemente las instalaciones deportivas.
                </p>
                <p className="mt-3 max-w-[64ch] text-sm font-semibold leading-6 text-[var(--color-primary-700)]">
                  El permiso autorizado y tu identificación permiten confirmar el ingreso en garita.
                </p>
              </div>
            </div>

            <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--color-primary-100)] bg-white shadow-xl lg:grid lg:grid-cols-[300px_1fr]">
              <div className="bg-[var(--color-unheval-navy)] p-3 sm:p-5 lg:p-7">
                <div className="hidden lg:block">
                  <p className="text-sm font-bold text-sky-200">Guía de uso</p>
                  <p className="mt-2 text-2xl font-extrabold text-white">Lo esencial, antes de llegar</p>
                </div>
                <div role="tablist" aria-label="Condiciones de uso de las losas" className="mt-0 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 lg:mt-10 lg:flex-col lg:overflow-visible lg:pb-0">
                  {NORMATIVA_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`tab-${tab.id}`}
                      data-tab={tab.id}
                      aria-selected={activeTab === tab.id}
                      aria-controls="panel-normativa"
                      tabIndex={activeTab === tab.id ? 0 : -1}
                      onClick={selectTab}
                      onKeyDown={handleTabKeyDown}
                      className={`min-h-12 shrink-0 snap-start rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-300 ${activeTab === tab.id ? "bg-white text-[var(--color-unheval-navy)] shadow-md" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div id="panel-normativa" role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="p-6 sm:p-9 lg:min-h-[430px] lg:p-12">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-2xl text-[var(--color-primary-600)]">
                    <ActiveNormativaIcon aria-hidden="true" />
                  </div>
                  <span className="text-5xl font-black tracking-[-0.04em] text-slate-100" aria-hidden="true">
                    {String(TAB_IDS.indexOf(activeTab) + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-8 text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-unheval-navy)] min-[400px]:text-3xl">{activeNormativa.titulo}</h3>
                <p className="mt-4 max-w-[68ch] text-base leading-7 text-slate-600">{activeNormativa.descripcion}</p>
                <ul className="mt-8 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2" role="list">
                  {activeNormativa.puntos.map((punto) => (
                    <li key={punto} className="flex min-h-14 items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <FaCheckCircle aria-hidden="true" />
                      </span>
                      {punto}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="bg-[var(--color-unheval-navy)] px-4 py-8 text-slate-300 sm:px-6">
        <div className="mx-auto max-w-[1180px]">
          <div className="grid gap-8 border-b border-white/10 pb-7 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <div className="flex items-start gap-3">
              <img src="/images/logo.png" alt="" width={44} height={44} className="h-11 w-11 rounded-lg bg-white p-1 object-contain" />
              <div>
                <p className="font-bold text-white">Universidad Nacional Hermilio Valdizán</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">Sistema institucional para permisos y uso de losas deportivas.</p>
              </div>
            </div>

            <nav aria-label="Enlaces de la página" className="text-sm">
              <p className="mb-3 font-bold text-white">Navegación</p>
              <div className="grid gap-2.5">
                <a href="#contenido-principal" className="flex min-h-11 w-fit items-center gap-2 rounded py-2 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400">
                  <FaHome className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
                  Inicio
                </a>
                <a href="#como-funciona" className="flex min-h-11 w-fit items-center gap-2 rounded py-2 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400">
                  <FaListOl className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
                  Cómo funciona
                </a>
                <a href="#servicios" className="flex min-h-11 w-fit items-center gap-2 rounded py-2 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400">
                  <FaThLarge className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
                  Servicios
                </a>
                <a href="#normativa" className="flex min-h-11 w-fit items-center gap-2 rounded py-2 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400">
                  <FaBook className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
                  Condiciones de uso
                </a>
              </div>
            </nav>

            <div className="text-sm">
              <p className="mb-3 font-bold text-white">Accesos</p>
              <div className="grid gap-2.5">
                <a href="https://unheval.edu.pe/portal/" target="_blank" rel="noreferrer" aria-label="Abrir el portal institucional de la UNHEVAL en una pestaña nueva" className="flex min-h-11 w-fit items-center gap-2 rounded py-2 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400">
                  <FaExternalLinkAlt className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
                  Portal UNHEVAL
                </a>
              </div>
            </div>
          </div>

          <p className="pt-6 text-sm text-blue-100">© {currentYear} Universidad Nacional Hermilio Valdizán. Sistema de Permisos de Losas Deportivas.</p>
        </div>
      </footer>
    </div>
  );
}
