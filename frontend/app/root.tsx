import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
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
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sistema de Permisos UNHEVAL</title>
        <Meta />
        <Links />

      </head>
      <body className="bg-[var(--bg-body)] text-[var(--text-primary)] antialiased font-sans">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
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
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-md animate-fade-in">
        {is404 ? (
          <div className="text-8xl font-black text-blue-600/20 mb-4">404</div>
        ) : (
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-100 flex items-center justify-center text-4xl">
            ⚠️
          </div>
        )}
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-3">{message}</h1>
        <p className="text-[var(--text-secondary)] mb-8">{details}</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          ← Volver al inicio
        </a>
      </div>
    </main>
  );
}
