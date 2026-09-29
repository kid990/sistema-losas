import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import Swal from "sweetalert2";
import { FaTrash, FaPlus, FaEye, FaFilter } from "react-icons/fa";
import { requireRole } from "~/services/auth.server";
import { api, responseHeadersWithCookies } from "~/services/api.server";
import { API_BASE_URL } from "~/lib/constants";
import { Button, Modal, Select } from "~/shared/components/ui";

function getImageSrc(foto: string) {
  if (!foto) return "";
  if (foto.startsWith("data:image") || foto.startsWith("blob:") || foto.startsWith("http")) return foto;
  if (/^[A-Za-z0-9+/=]+$/.test(foto)) return `data:image/jpeg;base64,${foto}`;
  return foto;
}

// Comprime y optimiza la imagen en el cliente antes de enviarla al servidor
async function compressImage(file: File, maxWidth = 1400, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    // Si no es imagen o es SVG/GIF, no tocar
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) return resolve(file);
            const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(optimizedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const [imagenes, losas] = await Promise.all([
    api.get("/imagenes", request).catch(() => ({ data: [] })),
    api.get("/losas", request).catch(() => ({ data: [] })),
  ]);
  return data(
    {
      imagenes: (imagenes as Record<string, unknown>).data || imagenes || [],
      losas: (losas as Record<string, unknown>).data || losas || [],
    },
    { headers: responseHeadersWithCookies(request) }
  );
}

export default function AdminImagenes() {
  const { imagenes, losas } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [modalOpen, setModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [selectedLosa, setSelectedLosa] = useState("");
  const [filterLosa, setFilterLosa] = useState("");

  const imgList = (imagenes as Record<string, unknown>[]) || [];
  const losasList = (losas as Record<string, unknown>[]) || [];

  const filteredImagenes = useMemo(() => {
    if (!filterLosa) return imgList;
    return imgList.filter((img) => String(img.id_l) === filterLosa);
  }, [imgList, filterLosa]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl("");
    }
  };

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
    if (!["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type) || selectedFile.size > 10 * 1024 * 1024) {
      Swal.fire({
        icon: "warning",
        title: "Imagen no válida",
        text: "Selecciona una imagen JPG, PNG o WebP de hasta 10 MB.",
      });
      return;
    }

    setIsUploading(true);
    Swal.fire({
      title: "Subiendo imagen...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const fileToUpload = await compressImage(selectedFile);

      const uploadForm = new FormData();
      uploadForm.append("imagen", fileToUpload);
      uploadForm.append("id_l", selectedLosa);

      const res = await fetch(`${API_BASE_URL}/imagenes/upload`, {
        method: "POST",
        body: uploadForm,
        credentials: "include",
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.ok === false || result.error) {
        Swal.fire({
          icon: "error",
          title: "Error al subir",
          text: result.error || result.message || "No se pudo subir la imagen",
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "Imagen subida",
          text: "La fotografía ha sido vinculada exitosamente.",
          timer: 1600,
          showConfirmButton: false,
        });
        setModalOpen(false);
        setSelectedFile(null);
        setPreviewUrl("");
        setSelectedLosa("");
        await revalidate();
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error de conexión",
        text: "Ocurrió un error inesperado al procesar la imagen.",
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
      const res = await fetch(`${API_BASE_URL}/imagenes/${img.id_img}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.ok === false) {
        throw new Error(result.error || result.message || "No se pudo eliminar la imagen");
      }
      await revalidate();
      Swal.fire({
        icon: "success",
        title: "Imagen eliminada",
        text: "La fotografía fue eliminada del sistema.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error instanceof Error ? error.message : "No se pudo eliminar la imagen seleccionada.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-200 text-xl font-bold">
            📷
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Galería de Imágenes de Losas
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Sube y administra el catálogo visual de fotografías mostradas en la vista pública
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setSelectedFile(null); setSelectedLosa(""); setModalOpen(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-sky-600 to-blue-600 shadow-md shadow-sky-200 hover:scale-[1.02] hover:shadow-lg transition-all"
        >
          <FaPlus size={12} aria-hidden="true" />
          Nueva Imagen
        </button>
      </div>

      <div className="card-theme p-4 mb-6 flex items-center gap-3 max-w-md">
        <FaFilter className="text-[var(--text-muted)] shrink-0" />
        <Select
          value={filterLosa}
          aria-label="Filtrar imágenes por losa"
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
              Archivo de Imagen (.jpg, .jpeg, .png, .webp) *
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary-50)] file:text-[var(--color-primary-600)] hover:file:bg-[var(--color-primary-100)] cursor-pointer"
              required
            />
            {previewUrl && (
              <div className="mt-3 relative aspect-video w-full max-h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner">
                <img src={previewUrl} alt="Vista previa" className="w-full h-full object-cover" />
                <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md font-mono">
                  Vista previa
                </span>
              </div>
            )}
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
              Subir
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
