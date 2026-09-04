import { Outlet, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireRole } from "~/services/auth.server";
import { NavbarSeguridad } from "~/shared/components/NavbarSeguridad";
import { Breadcrumb } from "~/shared/components/ui/Breadcrumb";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireRole(request, "trabajador", "Seguridad");
  return { user };
}

export default function SecurityLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-body)]">
      <NavbarSeguridad nombreUsuario={user.nombre} />
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-6 overflow-auto">
        <Breadcrumb />
        <Outlet />
      </main>
    </div>
  );
}
