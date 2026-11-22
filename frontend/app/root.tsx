import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";

// Los tokens JWT viven en cookies httpOnly del backend. El refresh es
// reactivo: api.server.ts detecta un access token ausente o expirado, renueva y reintenta.
export async function loader() {
  return null;
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap",
  },
];

const themeScript = `
  (() => {
    try {
      const stored = localStorage.getItem("sirlod-theme");
      const theme = stored === "light" || stored === "dark"
        ? stored
        : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {}
  })();
`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sistema de Permisos UNHEVAL</title>
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-[var(--bg-body)] text-[var(--text-primary)] antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function NavigationProgressBar() {
  const navigation = useNavigation();
  const isNavigating = Boolean(navigation.location);

  if (!isNavigating) return null;

  return (
    <div className="navigation-progress" role="progressbar" aria-label="Cargando página">
      <div />
    </div>
  );
}

export default function App() {
  return (
    <>
      <NavigationProgressBar />
      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "Ocurrió un error inesperado.";
  let is404 = false;

  if (isRouteErrorResponse(error)) {
    is404 = error.status === 404;
    message = is404 ? "404" : "Error";
    details = is404
      ? "La página solicitada no fue encontrada."
      : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-body)]">
      <div className="error-surface text-center max-w-md">
        {is404 ? (
          <div className="font-display text-8xl font-bold text-[var(--color-primary-500)] mb-4">404</div>
        ) : (
          <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-[var(--color-status-danger-soft)] text-[var(--color-status-danger)] flex items-center justify-center text-4xl">
            ⚠️
          </div>
        )}
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-3">{message}</h1>
        <p className="text-[var(--text-secondary)] mb-8">{details}</p>
        <a
          href="/"
          className="app-button app-button--primary"
        >
          ← Volver al inicio
        </a>
      </div>
    </main>
  );
}
