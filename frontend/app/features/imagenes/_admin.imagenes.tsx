import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import Swal from "sweetalert2";
import { FaTrash, FaPlus, FaEye, FaFilter } from "react-icons/fa";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { API_BASE_URL } from "~/lib/constants";
import { Button, Modal, Select } from "~/shared/components/ui";

function getImageSrc(foto: string) {
  if (!foto) return "";
  if (foto.startsWith("data:image")) return foto;
  if (/^[A-Za-z0-9+/=]+$/.test(foto)) return `data:image/jpeg;base64,${foto}`;
  return foto;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const [imagenes, losas] = await Promise.all([
    api.get("/imagenes", request),
    api.get("/losas", request),
  ]);
  return data({
    imagenes: (imagenes as Record<string, unknown>).data || imagenes || [],
    losas: (losas as Record<string, unknown>).data || losas || [],
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "upload") {
    const imageFile = fd.get("imagen") as File;
    const id_l = fd.get("id_l") as string;

    const uploadForm = new FormData();
    uploadForm.append("imagen", imageFile);
    uploadForm.append("id_l", id_l);

    // El token viaja en cookie httpOnly del backend: reenviar la cookie
    const res = await fetch(`${API_BASE_URL}/imagenes/upload`, {
      method: "POST",
      headers: { Cookie: request.headers.get("Cookie") || "" },
      body: uploadForm,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Error" }));
      return data({ error: err.message || "Error al subir" }, { status: res.status });
    }
  }

  if (intent === "delete") {
    await api.delete(`/imagenes/${fd.get("id_img")}`, request);
  }

  return data({ ok: true });
}

export default function AdminImagenes() {
  const { imagenes, losas } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [modalOpen, setModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLosa, setSelectedLosa] = useState("");
  const [filterLosa, setFilterLosa] = useState("");

  const imgList = (imagenes as Record<string, unknown>[]) || [];
  const losasList = (losas as Record<string, unknown>[]) || [];

  const filteredImagenes = useMemo(() => {
    if (!filterLosa) return imgList;
    return imgList.filter((img) => String(img.id_l) === filterLosa);
  }, [imgList, filterLosa]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedLosa) {
      Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Por favor selecciona un archivo de imagen y la losa correspondiente.",
      });
      return;
    }

    setIsUploading(true);
    Swal.fire({
      title: "Subiendo imagen...",
      text: "Guardando archivo en el servidor",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const fd = new FormData();
    fd.append("intent", "upload");
    fd.append("imagen", selectedFile);
    fd.append("id_l", selectedLosa);

    try {
      const res = await fetch("", { method: "post", body: fd });
      const result = await res.json();
      if (result.error) {
        Swal.fire({ icon: "error", title: "Error al subir", text: result.error });
      } else {
        Swal.fire({
          icon: "success",
          title: "Imagen subida",
          text: "La fotografía ha sido vinculada exitosamente a la losa.",
          timer: 1800,
          showConfirmButton: false,
        });
        setModalOpen(false);
        setSelectedFile(null);
        setSelectedLosa("");
        revalidate();
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error de conexión",
        text: "Ocurrió un error inesperado al subir la imagen.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (img: Record<string, unknown>) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar fotografía?",
      text: `Se eliminará la foto de la losa "${img.nombre_losa || `ID ${img.id_l}`}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EC5252",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      const fd = new FormData();
      fd.append("intent", "delete");
      fd.append("id_img", String(img.id_img));
      await fetch("", { method: "post", body: fd });
      revalidate();
      Swal.fire({
        icon: "success",
        title: "Imagen eliminada",
        text: "La fotografía fue eliminada del sistema.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo eliminar la imagen seleccionada.",
      });
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">Galería de Imágenes de Losas</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Sube y administra el catálogo visual de fotografías mostradas en la vista pública de losas.
          </p>
        </div>
        <Button onClick={() => { setSelectedFile(null); setSelectedLosa(""); setModalOpen(true); }}>
          <FaPlus className="inline mr-1" /> Nueva Imagen
        </Button>
      </div>

      <div className="card-theme p-4 mb-6 flex items-center gap-3 max-w-md">
        <FaFilter className="text-[var(--text-muted)] shrink-0" />
        <Select
          value={filterLosa}
          onChange={(e) => setFilterLosa(e.target.value)}
          placeholder="Todas las losas deportivas"
          className="mb-0 flex-1"
          options={losasList.map((l) => ({
            value: String(l.id_l),
            label: l.nombre ? `${l.nombre} (${l.numero_l || `L-${l.id_l}`})` : `Losa ID ${l.id_l}`,
          }))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {filteredImagenes.length === 0 ? (
          <div className="col-span-full card-theme text-center py-16 px-4">
            <svg className="mx-auto h-16 w-16 mb-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-semibold text-[var(--text-primary)]">
              {filterLosa ? "No hay imágenes para esta losa" : "No hay imágenes en la galería"}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-md mx-auto">
              {filterLosa ? "Prueba seleccionando otra losa o quita el filtro para ver todas." : "Haz clic en 'Nueva Imagen' para subir la primera foto al catálogo."}
            </p>
          </div>
        ) : (
          filteredImagenes.map((img) => (
            <div key={img.id_img as number} className="card-theme overflow-hidden flex flex-col hover-lift">
              <div className="relative aspect-4/3 w-full bg-[var(--bg-surface)] overflow-hidden">
                <img
                  src={getImageSrc(img.foto as string)}
                  alt={`Fotografía de ${img.nombre_losa || `Losa ID ${img.id_l}`}`}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/300x200?text=Sin+imagen"; }}
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">Losa asociada</p>
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate mt-0.5">
                    {(img.nombre_losa as string) || `Losa ID ${img.id_l}`}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--border-color)]">
                  <a
                    href={getImageSrc(img.foto as string)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ver foto completa de ${img.nombre_losa || `Losa ${img.id_l}`}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary-50)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-100)] rounded-lg text-xs font-medium transition-colors"
                  >
                    <FaEye size={12} /> Ver Original
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(img)}
                    aria-label={`Eliminar foto de ${img.nombre_losa || `Losa ${img.id_l}`}`}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar foto"
                  >
                    <FaTrash size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Subir Fotografía de Losa"
        size="md"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Archivo de Imagen (.jpg, .jpeg, .png) *
            </label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary-50)] file:text-[var(--color-primary-600)] hover:file:bg-[var(--color-primary-100)] cursor-pointer"
              required
            />
          </div>

          <Select
            label="Losa Deportiva Asociada *"
            value={selectedLosa}
            onChange={(e) => setSelectedLosa(e.target.value)}
            placeholder="Seleccione la losa..."
            required
            options={losasList.map((l) => ({
              value: String(l.id_l),
              label: l.nombre ? `${l.nombre} (${l.numero_l || `L-${l.id_l}`})` : `Losa ID ${l.id_l}`,
            }))}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={isUploading}>
              Subir Fotografía
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
