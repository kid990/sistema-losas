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
      borderRadius: "14px",
      overflow: "hidden",
    },
  },
  rows: {
    style: {
      backgroundColor: "var(--ui-surface)",
      color: "var(--ui-ink)",
      fontSize: "14px",
      fontWeight: "400",
      minHeight: "56px",
      borderBottom: "1px solid var(--ui-line)",
      transition: "all 0.15s ease",
    },
    stripedStyle: {
      backgroundColor: "var(--ui-surface-raised)",
      borderBottom: "1px solid var(--ui-line)",
    },
    highlightOnHoverStyle: {
      backgroundColor: "var(--color-primary-50)",
      transition: "background-color 0.15s ease",
    },
  },
  headRow: {
    style: {
      background: "var(--ui-surface-raised)",
      borderBottom: "1px solid var(--ui-line)",
      minHeight: "48px",
    },
  },
  headCells: {
    style: {
      color: "var(--ui-muted)",
      fontSize: "12.5px",
      fontWeight: "700",
      textTransform: "none" as const,
      letterSpacing: "normal",
      padding: "14px 18px",
    },
  },
  cells: {
    style: {
      color: "var(--ui-ink)",
      padding: "12px 18px",
    },
  },
  pagination: {
    style: {
      backgroundColor: "var(--ui-surface)",
      color: "var(--ui-muted)",
      borderTop: "1px solid var(--ui-line)",
      fontSize: "13px",
      minHeight: "52px",
      padding: "8px 16px",
    },
    pageButtonsStyle: {
      color: "var(--ui-primary)",
      fill: "var(--ui-primary)",
      backgroundColor: "var(--color-primary-50)",
      borderRadius: "8px",
      margin: "0 3px",
      padding: "6px",
      transition: "all 0.15s ease",
    },
  },
  noData: {
    style: {
      color: "var(--ui-muted)",
      fontSize: "14px",
      padding: "36px 16px",
      backgroundColor: "var(--ui-surface)",
    },
  },
  progress: {
    style: {
      backgroundColor: "transparent",
      color: "var(--ui-primary)",
    },
  },
  expanderRow: {
    style: {
      backgroundColor: "var(--ui-surface-raised)",
      color: "var(--ui-ink)",
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
        <div className="animate-pulse bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)]">
          <div className="h-11 bg-slate-100 rounded-xl mb-2" />
          {Array.from({ length: Math.min(datos.length || 3, 5) }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 border-b border-slate-100 rounded-lg mb-1" />
          ))}
          <div className="h-11 bg-slate-100 rounded-xl mt-2" />
        </div>
      ) : (
        <div className="table-surface bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden">
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
