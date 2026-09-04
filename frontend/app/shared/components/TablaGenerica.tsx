import { useState, useEffect } from "react";
import DataTable from "react-data-table-component";

const ALLOWED_COL_PROPS = [
  "name",
  "selector",
  "cell",
  "ignoreRowClick",
  "sortable",
  "grow",
  "center",
  "right",
  "left",
  "width",
  "minWidth",
  "maxWidth",
  "compact",
  "wrap",
  "format",
  "style",
  "conditionalCellStyles",
];

const cleanColumn = (col: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(col).filter(([key]) => ALLOWED_COL_PROPS.includes(key))
  );

interface TablaGenericaProps {
  columnas: Record<string, unknown>[];
  datos: unknown[];
  acciones?: (row: Record<string, unknown>) => React.ReactNode;
  titulo?: string;
  buscador?: React.ReactNode;
  mensajeVacio?: string;
  submensajeVacio?: string;
}

// Estilos personalizados que usan las variables CSS del tema
// Fondo transparente para que herede del contenedor padre
const tableCustomStyles = {
  table: {
    style: {
      backgroundColor: "transparent",
      borderRadius: "12px",
      overflow: "hidden",
    },
  },
  rows: {
    style: {
      backgroundColor: "transparent",
      color: "var(--text-primary)",
      fontSize: "14px",
      fontWeight: "400",
      borderBottom: "1px solid var(--border-color)",
      transition: "background-color 0.15s ease",
    },
    stripedStyle: {
      backgroundColor: "rgba(128, 128, 128, 0.04)",
      borderBottom: "1px solid var(--border-color)",
    },
    highlightOnHoverStyle: {
      backgroundColor: "rgba(59, 130, 246, 0.06)",
      transition: "background-color 0.15s ease",
    },
  },
  headRow: {
    style: {
      backgroundColor: "rgba(128, 128, 128, 0.06)",
      borderBottom: "2px solid var(--border-color)",
    },
  },
  headCells: {
    style: {
      color: "var(--text-primary)",
      fontSize: "13px",
      fontWeight: "700",
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      padding: "12px 16px",
    },
  },
  cells: {
    style: {
      color: "var(--text-primary)",
      padding: "10px 16px",
    },
  },
  pagination: {
    style: {
      backgroundColor: "transparent",
      color: "var(--text-primary)",
      borderTop: "1px solid var(--border-color)",
      fontSize: "13px",
      minHeight: "48px",
    },
    pageButtonsStyle: {
      color: "var(--text-primary)",
      fill: "var(--text-secondary)",
      backgroundColor: "transparent",
      borderRadius: "8px",
      transition: "all 0.15s ease",
    },
  },
  noData: {
    style: {
      color: "var(--text-secondary)",
      fontSize: "14px",
      padding: "24px 16px",
    },
  },
  progress: {
    style: {
      backgroundColor: "transparent",
      color: "var(--text-primary)",
    },
  },
  expanderRow: {
    style: {
      backgroundColor: "transparent",
      color: "var(--text-primary)",
    },
  },
};

export function TablaGenerica({
  columnas = [],
  datos = [],
  acciones,
  titulo,
  buscador,
  mensajeVacio = "No hay datos disponibles",
  submensajeVacio = "No se encontraron registros para mostrar",
}: TablaGenericaProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const columnasFinales = [
    ...columnas.map((col) => {
      const cleaned = cleanColumn(col);
      if (cleaned.sortable === undefined && !cleaned.cell) {
        cleaned.sortable = true;
      }
      return cleaned;
    }),
    ...(acciones
      ? [
          {
            name: "Acciones",
            cell: (row: Record<string, unknown>) => acciones(row),
            ignoreRowClick: true,
            sortable: false,
          } as Record<string, unknown>,
        ]
      : []),
  ];

  return (
    <div className="mt-4">
      {titulo && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-px bg-[var(--border-color)]" />
          <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-3">{titulo}</h4>
          <div className="flex-1 h-px bg-[var(--border-color)]" />
        </div>
      )}
      {buscador && <div className="mb-4">{buscador}</div>}
      {!isClient ? (
        // SSR: skeleton estático para evitar hydration mismatch de react-data-table-component
        <div className="animate-pulse">
          <div className="h-10 bg-gray-100 rounded-t-xl mb-1" />
          {Array.from({ length: Math.min(datos.length || 3, 5) }).map((_, i) => (
            <div key={i} className="h-12 bg-[var(--bg-surface)] border-b border-[var(--border-color)]" />
          ))}
          <div className="h-12 bg-gray-50 rounded-b-xl border border-[var(--border-color)]" />
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
          <DataTable
            columns={columnasFinales}
            data={datos}
            pagination
            responsive
            striped
            highlightOnHover
            persistTableHead
            customStyles={tableCustomStyles}
            paginationComponentOptions={{
              rowsPerPageText: "Filas por página:",
              rangeSeparatorText: "de",
              noRowsPerPage: false,
              selectAllRowsItem: false,
            }}
            noDataComponent={
              <div className="flex flex-col items-center justify-center py-12 text-[var(--text-secondary)]">
                <svg className="w-10 h-10 mb-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{mensajeVacio}</p>
                {submensajeVacio && <p className="text-xs text-[var(--text-muted)] mt-1">{submensajeVacio}</p>}
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
