from datetime import datetime, timedelta, timezone
from html import escape
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

BLUE = colors.HexColor("#1B6EB6")
NAVY = colors.HexColor("#12365A")
LIGHT_BLUE = colors.HexColor("#EAF3FB")
LIGHT_GRAY = colors.HexColor("#F4F7FA")
TEXT = colors.HexColor("#243447")
MUTED = colors.HexColor("#60758A")

MONTHS = (
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
)


def report_filename(report: dict[str, Any]) -> str:
    period = str(report["periodo"])
    suffix = f"{int(report['anio'])}"
    if period == "mensual" and report.get("mes"):
        suffix += f"_{int(report['mes']):02d}"
    return f"reporte_{period}_{suffix}.pdf"


def _safe(value: object) -> str:
    return escape(str(value if value is not None else "-"))


def _period_label(report: dict[str, Any]) -> str:
    if report["periodo"] == "mensual" and report.get("mes"):
        return f"{MONTHS[int(report['mes']) - 1]} de {report['anio']}"
    return f"Año {report['anio']}"


def _footer(canvas: Canvas, document: SimpleDocTemplate) -> None:
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D7E1EA"))
    canvas.line(18 * mm, 15 * mm, A4[0] - 18 * mm, 15 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 10 * mm, "SIRLOD - Universidad Nacional Hermilio Valdizán")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Página {document.page}")
    canvas.restoreState()


def build_report_pdf(report: dict[str, Any]) -> bytes:
    """Genera un reporte PDF institucional a partir del resumen consultado."""
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=17 * mm,
        bottomMargin=21 * mm,
        title=f"Reporte de permisos - {_period_label(report)}",
        author="SIRLOD - UNHEVAL",
    )
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=19,
            leading=23,
            textColor=NAVY,
            alignment=TA_CENTER,
            spaceAfter=4 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionTitle",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=NAVY,
            spaceBefore=4 * mm,
            spaceAfter=2 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SmallMuted",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=MUTED,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Cell",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=TEXT,
        )
    )

    lima_timezone = timezone(timedelta(hours=-5))
    generated_at = datetime.now(lima_timezone).strftime("%d/%m/%Y %H:%M")
    story: list[Any] = [
        Paragraph("SIRLOD - UNHEVAL", styles["SmallMuted"]),
        Paragraph("Reporte de permisos y uso de losas", styles["ReportTitle"]),
        Paragraph(
            f"Periodo: <b>{_safe(_period_label(report))}</b> &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"Desde {_safe(report['desde'])} hasta {_safe(report['hasta'])} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"Generado: {generated_at}",
            styles["SmallMuted"],
        ),
        Spacer(1, 5 * mm),
    ]

    metrics = [
        ["PERMISOS", "HORAS RESERVADAS", "TASA DE APROBACIÓN", "PERIODO"],
        [
            str(report["total_permisos"]),
            str(report["horas_reservadas"]),
            f"{report['tasa_aprobacion']}%",
            _period_label(report),
        ],
    ]
    metrics_table = Table(metrics, colWidths=[43 * mm, 43 * mm, 43 * mm, 43 * mm])
    metrics_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BLUE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 7),
                ("BACKGROUND", (0, 1), (-1, 1), LIGHT_BLUE),
                ("TEXTCOLOR", (0, 1), (-1, 1), NAVY),
                ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 1), (-1, 1), 12),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#BBD2E7")),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#BBD2E7")),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(metrics_table)

    statuses = report.get("por_estado", {})
    permission_types = report.get("por_tipo", {})
    summary_data = [["Estado", "Cantidad", "Tipo", "Cantidad"]]
    status_rows = list(statuses.items()) or [("Sin datos", 0)]
    type_rows = list(permission_types.items()) or [("Sin datos", 0)]
    for index in range(max(len(status_rows), len(type_rows))):
        status = status_rows[index] if index < len(status_rows) else ("", "")
        permission_type = type_rows[index] if index < len(type_rows) else ("", "")
        summary_data.append([status[0], status[1], permission_type[0], permission_type[1]])
    summary_table = Table(summary_data, colWidths=[52 * mm, 30 * mm, 52 * mm, 30 * mm], repeatRows=1)
    summary_table.setStyle(_standard_table_style())
    story.extend([Paragraph("Distribución de permisos", styles["SectionTitle"]), summary_table])

    courts = report.get("por_losa", [])
    court_data: list[list[Any]] = [["Losa deportiva", "Reservas aceptadas", "Horas"]]
    court_data.extend(
        [Paragraph(_safe(item["losa"]), styles["Cell"]), item["reservas"], item["horas"]]
        for item in courts
    )
    if not courts:
        court_data.append(["No hay reservas aceptadas en este periodo", "0", "0"])
    court_table = Table(court_data, colWidths=[96 * mm, 42 * mm, 30 * mm], repeatRows=1)
    court_table.setStyle(_standard_table_style())
    story.extend([Paragraph("Uso por losa", styles["SectionTitle"]), court_table])

    source = report.get("analisis_fuente", "local")
    source_label = "DeepSeek" if source == "deepseek" else "respaldo local"
    analysis = report.get("analisis") or {}
    story.extend(
        [
            Paragraph(f"Análisis con IA - {source_label}", styles["SectionTitle"]),
            Paragraph(_safe(analysis.get("resumen_ejecutivo", "Sin análisis disponible.")), styles["Cell"]),
            Paragraph("Hallazgos", styles["SectionTitle"]),
            *[
                Paragraph(f"- {_safe(item)}", styles["Cell"])
                for item in analysis.get("hallazgos", [])
            ],
            Paragraph("Recomendaciones", styles["SectionTitle"]),
            *[
                Paragraph(f"- {_safe(item)}", styles["Cell"])
                for item in analysis.get("recomendaciones", [])
            ],
        ]
    )
    document.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()


def _standard_table_style() -> TableStyle:
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("BACKGROUND", (0, 1), (-1, -1), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
            ("TEXTCOLOR", (0, 1), (-1, -1), TEXT),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("ALIGN", (1, 1), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D7E1EA")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]
    )
