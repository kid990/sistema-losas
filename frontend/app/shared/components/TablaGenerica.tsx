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
      borderRadius: "16px",
      overflow: "hidden",
    },
  },
  rows: {
    style: {
      backgroundColor: "#ffffff",
      color: "#1e293b",
      fontSize: "14px",
      fontWeight: "400",
      minHeight: "56px",
      borderBottom: "1px solid #f1f5f9",
      transition: "all 0.15s ease",
    },
    stripedStyle: {
      backgroundColor: "#f8fafc",
      borderBottom: "1px solid #f1f5f9",
    },
    highlightOnHoverStyle: {
      backgroundColor: "#f0f7ff",
      transition: "background-color 0.15s ease",
    },
  },
  headRow: {
    style: {
      background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
      borderBottom: "2px solid #e2e8f0",
      minHeight: "48px",
    },
  },
  headCells: {
    style: {
      color: "#475569",
      fontSize: "12.5px",
      fontWeight: "700",
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      padding: "14px 18px",
    },
  },
  cells: {
    style: {
      color: "#1e293b",
      padding: "12px 18px",
    },
  },
  pagination: {
    style: {
      backgroundColor: "#ffffff",
      color: "#475569",
      borderTop: "1px solid #e2e8f0",
      fontSize: "13px",
      minHeight: "52px",
      padding: "8px 16px",
    },
    pageButtonsStyle: {
      color: "#1B6EB6",
      fill: "#1B6EB6",
      backgroundColor: "#f0f7ff",
      borderRadius: "8px",
      margin: "0 3px",
      padding: "6px",
      transition: "all 0.15s ease",
    },
  },
  noData: {
    style: {
      color: "#64748b",
      fontSize: "14px",
      padding: "36px 16px",
      backgroundColor: "#ffffff",
    },
  },
  progress: {
    style: {
      backgroundColor: "transparent",
      color: "#1B6EB6",
    },
  },
  expanderRow: {
    style: {
      backgroundColor: "#f8fafc",
      color: "#1e293b",
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
            cell: (row: Record<string, unknown>) => <div className="table-actions">{acciones(row)}</div>,
            ignoreRowClick: true,
            sortable: false,
          } as Record<string, unknown>,
        ]
      : []),
  ];

  return (
    <div className="data-table-container mt-2">
      {titulo && (
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{titulo}</h4>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
        </div>
      )}
      {buscador && <div className="mb-4">{buscador}</div>}
      {!isClient ? (
        // SSR: skeleton estático para evitar hydration mismatch de react-data-table-component
        <div className="animate-pulse bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="h-11 bg-slate-100 rounded-xl mb-2" />
          {Array.from({ length: Math.min(datos.length || 3, 5) }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 border-b border-slate-100 rounded-lg mb-1" />
          ))}
          <div className="h-11 bg-slate-100 rounded-xl mt-2" />
        </div>
      ) : (
        <div className="table-surface bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] overflow-hidden">
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
