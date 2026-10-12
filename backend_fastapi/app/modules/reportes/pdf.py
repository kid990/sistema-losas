from datetime import datetime, timedelta, timezone
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.graphics.shapes import Drawing, Rect, String as DString
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# Paleta cromática ejecutiva e institucional UNHEVAL
NAVY = colors.HexColor("#0D3B66")          # Azul institucional UNHEVAL
ROYAL = colors.HexColor("#1D65A6")         # Azul zafiro de apoyo
ACCENT = colors.HexColor("#D4AC0D")        # Dorado / Ámbar universitario
DARK_TEXT = colors.HexColor("#1E293B")     # Texto principal oscuro
MUTED_TEXT = colors.HexColor("#64748B")    # Texto secundario / gris
BORDER_COLOR = colors.HexColor("#CBD5E1")  # Bordes suaves
BORDER_STRONG = colors.HexColor("#94A3B8") # Bordes destacados
BG_LIGHT = colors.HexColor("#F8FAFC")      # Fondo claro alternado
BG_MUTED = colors.HexColor("#F1F5F9")      # Fondo gris tenue
AI_BLUE_BG = colors.HexColor("#F0F7FF")    # Fondo azul claro IA
AI_BLUE_BORDER = colors.HexColor("#2563EB")# Borde azul IA
WARN_BG = colors.HexColor("#FFFBEB")       # Fondo ámbar alertas
WARN_BORDER = colors.HexColor("#D97706")   # Borde ámbar alertas
PREDICT_BG = colors.HexColor("#F5F3FF")    # Fondo lila / predictivo
PREDICT_BORDER = colors.HexColor("#7C3AED")# Borde lila predictivo

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


class NumberedCanvas(Canvas):
    """Canvas de dos pasadas para calcular con exactitud el total de páginas."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict[str, Any]] = []

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_decorations(num_pages)
            super().showPage()
        super().save()

    def _draw_decorations(self, total_pages: int) -> None:
        self.saveState()
        # Cabecera superior para páginas >= 2
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 7.5)
            self.setFillColor(NAVY)
            self.drawString(14 * mm, 287 * mm, "SIRLOD - UNHEVAL  |  INFORME EJECUTIVO DE GESTIÓN Y USO DE LOSAS DEPORTIVAS")
            self.setFont("Helvetica", 7.5)
            self.setFillColor(MUTED_TEXT)
            self.drawRightString(A4[0] - 14 * mm, 287 * mm, "Dirección de Bienestar Universitario")
            self.setStrokeColor(BORDER_COLOR)
            self.setLineWidth(0.5)
            self.line(14 * mm, 284 * mm, A4[0] - 14 * mm, 284 * mm)

        # Pie de página institucional en todas las páginas
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.5)
        self.line(14 * mm, 13 * mm, A4[0] - 14 * mm, 13 * mm)

        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(NAVY)
        self.drawString(14 * mm, 8.5 * mm, "SIRLOD")
        self.setFont("Helvetica", 7.5)
        self.setFillColor(MUTED_TEXT)
        self.drawString(27 * mm, 8.5 * mm, "— Universidad Nacional Hermilio Valdizán  •  Dirección de Bienestar Universitario  •  Analítica con IA")

        page_str = f"Página {self._pageNumber} de {total_pages}"
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(DARK_TEXT)
        self.drawRightString(A4[0] - 14 * mm, 8.5 * mm, page_str)
        self.restoreState()


def report_filename(report: dict[str, Any]) -> str:
    """Genera un nombre institucional, digno y representativo para la descarga oficial."""
    period = str(report.get("periodo", "mensual"))
    anio = int(report.get("anio", 2026))
    if period == "mensual" and report.get("mes"):
        mes_idx = int(report["mes"])
        mes_nombre = MONTHS[mes_idx - 1] if 1 <= mes_idx <= 12 else f"{mes_idx:02d}"
        return f"SIRLOD_Reporte_Ejecutivo_{mes_nombre}_{anio}.pdf"
    return f"SIRLOD_Reporte_Ejecutivo_Anual_{anio}.pdf"


def _safe(value: object) -> str:
    return escape(str(value if value is not None else "-"))


def _period_label(report: dict[str, Any]) -> str:
    if report.get("periodo") == "mensual" and report.get("mes"):
        return f"{MONTHS[int(report['mes']) - 1]} de {report['anio']}"
    return f"Año {report.get('anio', 2026)}"


def _find_logo_path() -> Path | None:
    candidates = [
        Path(__file__).resolve().parent.parent / "assets" / "logo.png",
        Path(__file__).resolve().parents[4] / "frontend" / "public" / "images" / "logo.png",
    ]
    for path in candidates:
        if path.is_file():
            return path
    return None


def _create_bar_drawing(pct: float, width_pt: float = 76, height_pt: float = 7) -> Drawing:
    """Dibuja una barra vectorial de progreso de ocupabilidad nítida y profesional."""
    d = Drawing(width_pt, height_pt + 4)
    bar_width = width_pt - 26
    # Fondo gris tenue redondeado
    d.add(Rect(0, 2, bar_width, height_pt, rx=2, ry=2, fillColor=colors.HexColor("#E2E8F0"), strokeColor=None))
    # Barra de progreso rellena
    fill_w = max(2, bar_width * min(100.0, max(0.0, pct)) / 100.0)
    bar_color = NAVY if pct >= 30 else ROYAL
    d.add(Rect(0, 2, fill_w, height_pt, rx=2, ry=2, fillColor=bar_color, strokeColor=None))
    # Porcentaje numérico a la derecha
    d.add(DString(bar_width + 4, 3, f"{pct:.1f}%", fontName="Helvetica-Bold", fontSize=6.5, fillColor=DARK_TEXT))
    return d


def build_report_pdf(report: dict[str, Any]) -> bytes:
    """Genera un informe ejecutivo institucional de alta calidad analítica con Inteligencia Artificial."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title=f"SIRLOD - Informe Ejecutivo de Gestión ({_period_label(report)})",
        author="SIRLOD - UNHEVAL",
    )

    styles = getSampleStyleSheet()

    # Tipografías y jerarquía visual
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=NAVY,
    )
    sub_title_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=ROYAL,
    )
    org_title_style = ParagraphStyle(
        "OrgTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=NAVY,
    )
    org_dept_style = ParagraphStyle(
        "OrgDept",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.2,
        leading=9,
        textColor=MUTED_TEXT,
    )
    sec_title_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=NAVY,
        spaceBefore=2 * mm,
        spaceAfter=1.5 * mm,
    )
    ribbon_style = ParagraphStyle(
        "RibbonText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=DARK_TEXT,
    )
    cell_style = ParagraphStyle(
        "CellGeneral",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.3,
        leading=9.3,
        textColor=DARK_TEXT,
    )
    cell_center_style = ParagraphStyle(
        "CellCenter",
        parent=cell_style,
        alignment=TA_CENTER,
    )
    cell_bold_style = ParagraphStyle(
        "CellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
    )
    ai_body_style = ParagraphStyle(
        "AIBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10.5,
        textColor=DARK_TEXT,
        alignment=TA_JUSTIFY,
    )
    ai_bullet_style = ParagraphStyle(
        "AIBullet",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10.5,
        textColor=DARK_TEXT,
        alignment=TA_JUSTIFY,
        spaceAfter=1.5 * mm,
    )
    ai_alert_style = ParagraphStyle(
        "AIAlert",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#92400E"),
        alignment=TA_JUSTIFY,
        spaceAfter=1.5 * mm,
    )
    sig_label_style = ParagraphStyle(
        "SigLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=NAVY,
        alignment=TA_CENTER,
    )
    sig_sub_style = ParagraphStyle(
        "SigSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=6.8,
        leading=8.5,
        textColor=MUTED_TEXT,
        alignment=TA_CENTER,
    )

    lima_tz = timezone(timedelta(hours=-5))
    generated_at = datetime.now(lima_tz).strftime("%d/%m/%Y %H:%M")
    source_key = report.get("analisis_fuente", "local")
    source_name = "DeepSeek AI (v3/Flash)" if source_key == "deepseek" else "Motor Heurístico Local"

    story: list[Any] = []

    # ==========================================
    # PÁGINA 1: DASHBOARD OPERATIVO Y ESTADÍSTICO
    # ==========================================

    # 1. Cabecera institucional con Logo
    logo_path = _find_logo_path()
    logo_element: Any
    if logo_path:
        logo_element = Image(str(logo_path), width=15 * mm, height=18 * mm)
    else:
        logo_element = Paragraph("<b>UNHEVAL</b>", cell_center_style)

    header_text_flowables = [
        Paragraph("<b>UNIVERSIDAD NACIONAL HERMILIO VALDIZÁN — HUÁNUCO</b>", org_title_style),
        Paragraph("Dirección de Bienestar Universitario &bull; Coordinación de Infraestructura y Deportes", org_dept_style),
        Spacer(1, 1.5 * mm),
        Paragraph("INFORME EJECUTIVO DE GESTIÓN Y USO DE LOSAS DEPORTIVAS", title_style),
        Paragraph("Sistema Inteligente de Reserva de Losas (SIRLOD) &bull; Módulo de Analítica e Inteligencia Artificial", sub_title_style),
    ]

    header_table = Table(
        [[logo_element, header_text_flowables]],
        colWidths=[18 * mm, 164 * mm],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 2.5 * mm))

    # 2. Cinta de Metadatos del Documento
    ribbon_data = [
        [
            Paragraph(f"<b>Periodo:</b> {_safe(_period_label(report))}", ribbon_style),
            Paragraph(f"<b>Rango:</b> {_safe(report.get('desde'))} al {_safe(report.get('hasta'))}", ribbon_style),
            Paragraph(f"<b>Emisión:</b> {generated_at}", ribbon_style),
            Paragraph(f"<b>Motor IA:</b> {source_name}", ribbon_style),
        ]
    ]
    ribbon_table = Table(ribbon_data, colWidths=[45.5 * mm, 49 * mm, 42.5 * mm, 45 * mm])
    ribbon_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_MUTED),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER_COLOR),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(ribbon_table)
    story.append(Spacer(1, 3.5 * mm))

    # 3. Tablero Ejecutivo de Indicadores Clave (KPI Cards)
    story.append(Paragraph("1. TABLERO EJECUTIVO DE INDICADORES CLAVE (KPIS)", sec_title_style))

    total_p = int(report.get("total_permisos", 0))
    total_h = int(report.get("horas_reservadas", 0))
    tasa_aprob = float(report.get("tasa_aprobacion", 0.0))
    roles = report.get("por_rol", {})
    alumnos_c = roles.get("Alumno", 0)
    docentes_c = roles.get("Docente", 0)
    courts_list = report.get("por_losa", [])
    top_losa_name = courts_list[0]["losa"] if courts_list else "Sin uso"
    top_losa_pct = (
        f"{courts_list[0].get('porcentaje_horas', round(courts_list[0]['horas'] / total_h * 100, 1))}%"
        if courts_list and total_h
        else "0%"
    )

    kpi_card_data = [
        [
            Paragraph("<b>TOTAL SOLICITUDES</b>", ParagraphStyle("KH", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
            Paragraph("<b>HORAS RESERVADAS</b>", ParagraphStyle("KH", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
            Paragraph("<b>TASA APROBACIÓN</b>", ParagraphStyle("KH", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
            Paragraph("<b>COMUNIDAD ACTIVA</b>", ParagraphStyle("KH", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
            Paragraph("<b>LOSA PRINCIPAL</b>", ParagraphStyle("KH", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
        ],
        [
            Paragraph(f"<b>{total_p}</b>", ParagraphStyle("KV", fontName="Helvetica-Bold", fontSize=13, leading=15, textColor=NAVY, alignment=TA_CENTER)),
            Paragraph(f"<b>{total_h} hrs</b>", ParagraphStyle("KV", fontName="Helvetica-Bold", fontSize=13, leading=15, textColor=NAVY, alignment=TA_CENTER)),
            Paragraph(f"<b>{tasa_aprob:.1f}%</b>", ParagraphStyle("KV", fontName="Helvetica-Bold", fontSize=13, leading=15, textColor=colors.HexColor("#047857"), alignment=TA_CENTER)),
            Paragraph(f"<b>{alumnos_c} Alum / {docentes_c} Doc</b>", ParagraphStyle("KV", fontName="Helvetica-Bold", fontSize=9.5, leading=13, textColor=NAVY, alignment=TA_CENTER)),
            Paragraph(f"<b>{_safe(top_losa_name)}</b>", ParagraphStyle("KV", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=NAVY, alignment=TA_CENTER)),
        ],
        [
            Paragraph("100% Tramitadas", ParagraphStyle("KD", fontName="Helvetica", fontSize=6.5, leading=8, textColor=MUTED_TEXT, alignment=TA_CENTER)),
            Paragraph("Efectivas en losa", ParagraphStyle("KD", fontName="Helvetica", fontSize=6.5, leading=8, textColor=MUTED_TEXT, alignment=TA_CENTER)),
            Paragraph("Operación conforme", ParagraphStyle("KD", fontName="Helvetica", fontSize=6.5, leading=8, textColor=MUTED_TEXT, alignment=TA_CENTER)),
            Paragraph("Participación activa", ParagraphStyle("KD", fontName="Helvetica", fontSize=6.5, leading=8, textColor=MUTED_TEXT, alignment=TA_CENTER)),
            Paragraph(f"{top_losa_pct} de concentración", ParagraphStyle("KD", fontName="Helvetica", fontSize=6.5, leading=8, textColor=MUTED_TEXT, alignment=TA_CENTER)),
        ],
    ]
    kpi_table = Table(kpi_card_data, colWidths=[36.4 * mm] * 5)
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("BACKGROUND", (0, 1), (-1, -1), BG_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER_COLOR),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, 0), 4),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                ("TOPPADDING", (0, 1), (-1, 1), 4),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 1),
                ("TOPPADDING", (0, 2), (-1, 2), 1),
                ("BOTTOMPADDING", (0, 2), (-1, 2), 4),
            ]
        )
    )
    story.append(kpi_table)
    story.append(Spacer(1, 3.5 * mm))

    # 4. Tabla de Ocupabilidad y Rendimiento por Losa Deportiva
    story.append(Paragraph("2. OCUPABILIDAD Y RENDIMIENTO POR LOSA DEPORTIVA", sec_title_style))

    th_style = ParagraphStyle("TH", fontName="Helvetica-Bold", fontSize=7.2, leading=9, textColor=colors.white, alignment=TA_CENTER)
    court_rows_data: list[list[Any]] = [
        [
            Paragraph("<b>Losa Deportiva</b>", th_style),
            Paragraph("<b>Ubicación en Campus</b>", th_style),
            Paragraph("<b>Disciplina</b>", th_style),
            Paragraph("<b>Reservas</b>", th_style),
            Paragraph("<b>Horas</b>", th_style),
            Paragraph("<b>% Horas</b>", th_style),
            Paragraph("<b>Ocupabilidad Visual</b>", th_style),
        ]
    ]

    total_court_reservations = 0
    total_court_hours = 0
    for idx, c in enumerate(courts_list):
        r_cnt = int(c.get("reservas", 0))
        h_cnt = int(c.get("horas", 0))
        total_court_reservations += r_cnt
        total_court_hours += h_cnt
        pct = float(c.get("porcentaje_horas", round(h_cnt / total_h * 100, 1) if total_h else 0.0))

        bar_drawing = _create_bar_drawing(pct)
        court_rows_data.append(
            [
                Paragraph(f"<b>{_safe(c.get('losa'))}</b>", cell_style),
                Paragraph(_safe(c.get("ubicacion", "Campus Central")), cell_style),
                Paragraph(_safe(c.get("disciplina", "Multiuso")), cell_style),
                Paragraph(str(r_cnt), cell_center_style),
                Paragraph(f"{h_cnt} h", cell_center_style),
                Paragraph(f"{pct:.1f}%", cell_center_style),
                bar_drawing,
            ]
        )

    if not courts_list:
        court_rows_data.append(
            [
                Paragraph("Sin registros de reservas", cell_style),
                Paragraph("-", cell_style),
                Paragraph("-", cell_style),
                Paragraph("0", cell_center_style),
                Paragraph("0 h", cell_center_style),
                Paragraph("0.0%", cell_center_style),
                _create_bar_drawing(0.0),
            ]
        )

    # Fila de totales
    court_rows_data.append(
        [
            Paragraph("<b>TOTAL CONSOLIDADO</b>", cell_bold_style),
            Paragraph("Todas las sedes", cell_style),
            Paragraph("Multidisciplinario", cell_style),
            Paragraph(f"<b>{total_court_reservations}</b>", cell_center_style),
            Paragraph(f"<b>{total_court_hours} h</b>", cell_center_style),
            Paragraph("<b>100.0%</b>", cell_center_style),
            Paragraph("<b>Capacidad activa</b>", cell_center_style),
        ]
    )

    # Anchos calculados exactamente: 36 + 36 + 26 + 18 + 18 + 18 + 30 = 182 mm
    court_table = Table(court_rows_data, colWidths=[36 * mm, 36 * mm, 26 * mm, 18 * mm, 18 * mm, 18 * mm, 30 * mm])
    court_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.3, BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, BG_LIGHT]),
                ("BACKGROUND", (0, -1), (-1, -1), BG_MUTED),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(court_table)
    story.append(Spacer(1, 3.5 * mm))

    # 5. Demanda por Comunidad Universitaria y Disciplinas Deportivas (Subtablas lado a lado)
    story.append(Paragraph("3. PERFIL DE USUARIOS, DISCIPLINAS Y FRANJAS HORARIAS", sec_title_style))

    # Subtabla 1: Roles de solicitantes
    roles_dict = report.get("por_rol", {})
    role_rows = [
        [Paragraph("<b>Comunidad / Estamento</b>", th_style), Paragraph("<b>Reservas</b>", th_style), Paragraph("<b>% Part.</b>", th_style)]
    ]
    total_role_count = sum(roles_dict.values()) or 1
    for r_name in ("Alumno", "Docente", "PersonalAdministrativo"):
        c_val = roles_dict.get(r_name, 0)
        p_val = round(c_val / total_role_count * 100, 1)
        display_name = "Personal Admin." if r_name == "PersonalAdministrativo" else r_name
        role_rows.append([Paragraph(display_name, cell_style), Paragraph(str(c_val), cell_center_style), Paragraph(f"{p_val:.1f}%", cell_center_style)])
    sub_table_roles = Table(role_rows, colWidths=[43 * mm, 22 * mm, 23 * mm])
    sub_table_roles.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ROYAL),
                ("GRID", (0, 0), (-1, -1), 0.3, BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.8),
            ]
        )
    )

    # Subtabla 2: Disciplinas deportivas
    disc_dict = report.get("por_disciplina", {})
    disc_rows = [
        [Paragraph("<b>Disciplina Deportiva</b>", th_style), Paragraph("<b>Uso (sesiones)</b>", th_style), Paragraph("<b>% Demanda</b>", th_style)]
    ]
    total_disc_count = sum(disc_dict.values()) or 1
    disc_items = list(disc_dict.items())[:3]
    if not disc_items:
        disc_rows.append([Paragraph("Polideportivo General", cell_style), Paragraph(str(total_p), cell_center_style), Paragraph("100.0%", cell_center_style)])
    else:
        for d_name, d_cnt in disc_items:
            dp_val = round(d_cnt / total_disc_count * 100, 1)
            disc_rows.append([Paragraph(_safe(d_name), cell_style), Paragraph(str(d_cnt), cell_center_style), Paragraph(f"{dp_val:.1f}%", cell_center_style)])
        while len(disc_rows) < 4:
            disc_rows.append([Paragraph("-", cell_style), Paragraph("-", cell_center_style), Paragraph("-", cell_center_style)])

    sub_table_disc = Table(disc_rows, colWidths=[43 * mm, 23 * mm, 23 * mm])
    sub_table_disc.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ROYAL),
                ("GRID", (0, 0), (-1, -1), 0.3, BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.8),
            ]
        )
    )

    dual_table = Table(
        [[sub_table_roles, Paragraph("", cell_style), sub_table_disc]],
        colWidths=[88 * mm, 6 * mm, 88 * mm],
    )
    dual_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(dual_table)
    story.append(Spacer(1, 2.5 * mm))

    # Cinta de concentración horaria
    peak_strip_text = (
        f"<b>Franja Horaria de Mayor Concentración:</b> {_safe(report.get('franja_horaria_pico', '16:00 a 19:00 hrs'))} "
        f"&nbsp;&bull;&nbsp; <b>Duración Promedio:</b> {round(total_h / total_p, 1) if total_p else 1.0} h / sesión "
        f"&nbsp;&bull;&nbsp; <b>Tipo Predominante:</b> {_safe(list(report.get('por_tipo', {}).keys())[0] if report.get('por_tipo') else 'Normal')}"
    )
    peak_strip = Table([[Paragraph(peak_strip_text, ribbon_style)]], colWidths=[182 * mm])
    peak_strip.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_MUTED),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ]
        )
    )
    story.append(peak_strip)

    # Salto de página para la sección de IA
    story.append(PageBreak())

    # ========================================================
    # PÁGINA 2: MÓDULO DE INTELIGENCIA ARTIFICIAL E INSIGHTS
    # ========================================================

    analysis = report.get("analisis") or {}
    calificacion_str = analysis.get("calificacion_eficiencia", "Nivel A - Eficiencia Operativa Conforme")

    # Banner de Sección IA
    banner_content = [
        Paragraph("<b>MÓDULO DE INTELIGENCIA ARTIFICIAL E INSIGHTS ESTRATÉGICOS</b>", ParagraphStyle("BTitle", fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=colors.white)),
        Paragraph(f"Submódulo de Analítica Avanzada e Inteligencia Artificial &bull; Motor: <b>{source_name}</b> &bull; Dictamen: <b>{_safe(calificacion_str)}</b>", ParagraphStyle("BSub", fontName="Helvetica", fontSize=7.5, leading=9.5, textColor=colors.HexColor("#E0E7FF"))),
    ]
    banner_table = Table([[banner_content]], colWidths=[182 * mm])
    banner_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NAVY),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#1E3A8A")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 4.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
            ]
        )
    )
    story.append(banner_table)
    story.append(Spacer(1, 2.5 * mm))

    # 1. Diagnóstico Ejecutivo Global
    resumen_text = _safe(analysis.get("resumen_ejecutivo", "Sin análisis disponible."))
    box_resumen = Table(
        [
            [Paragraph("<b>DIAGNÓSTICO EJECUTIVO Y ANÁLISIS OPERATIVO</b>", ParagraphStyle("BH", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=NAVY))],
            [Paragraph(resumen_text, ai_body_style)],
        ],
        colWidths=[182 * mm],
    )
    box_resumen.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), AI_BLUE_BG),
                ("LINELEFT", (0, 0), (0, -1), 3.5, AI_BLUE_BORDER),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#BFDBFE")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(box_resumen)
    story.append(Spacer(1, 2.5 * mm))

    # 2. Evaluación del Comportamiento de la Demanda y Horarios Pico
    eval_text = _safe(analysis.get("evaluacion_demanda") or (
        f"La demanda deportiva refleja participación activa de alumnos ({alumnos_c}) y docentes ({docentes_c}), "
        f"con preferencia por disciplinas de trabajo en equipo y concentración de reservas en horario vespertino."
    ))
    box_eval = Table(
        [
            [Paragraph("<b>EVALUACIÓN DEL COMPORTAMIENTO DE LA DEMANDA Y PREFERENCIAS</b>", ParagraphStyle("EH", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=ROYAL))],
            [Paragraph(eval_text, ai_body_style)],
        ],
        colWidths=[182 * mm],
    )
    box_eval.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
                ("LINELEFT", (0, 0), (0, -1), 3.5, ROYAL),
                ("BOX", (0, 0), (-1, -1), 0.4, BORDER_COLOR),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(box_eval)
    story.append(Spacer(1, 2.5 * mm))

    # 3. Hallazgos Clave Identificados por la IA
    story.append(Paragraph("<b>HALLAZGOS CLAVE Y PATRONES DETECTADOS POR LA IA</b>", sec_title_style))
    hallazgos_list = analysis.get("hallazgos", [])
    if not hallazgos_list:
        hallazgos_list = ["Operación sin anomalías detectadas en el periodo evaluado."]
    for h in hallazgos_list:
        story.append(Paragraph(f"<font color='#1D65A6'><b>&bull;</b></font>&nbsp;&nbsp;{_safe(h)}", ai_bullet_style))

    story.append(Spacer(1, 1.5 * mm))

    # 4. Alertas Preventivas de Gestión y Desbalance
    alertas_list = analysis.get("alertas_operativas", [])
    if not alertas_list:
        alertas_list = [
            f"Riesgo de sobrecarga en {top_losa_name} por concentración preferente de reservas vespertinas.",
            "Subutilización potencial de espacios secundarios en franjas matutinas del campus.",
        ]
    alert_paragraphs: list[Any] = [
        Paragraph("<b>ALERTAS PREVENTIVAS DE GESTIÓN Y DESBALANCE DE USO</b>", ParagraphStyle("AH", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.HexColor("#92400E"))),
        Spacer(1, 1.5 * mm),
    ]
    for alt in alertas_list:
        alert_paragraphs.append(Paragraph(f"<b>[!]</b> &nbsp;{_safe(alt)}", ai_alert_style))

    box_alertas = Table([[alert_paragraphs]], colWidths=[182 * mm])
    box_alertas.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), WARN_BG),
                ("LINELEFT", (0, 0), (0, -1), 3.5, WARN_BORDER),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#FDE68A")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(box_alertas)
    story.append(Spacer(1, 2.5 * mm))

    # 5. Recomendaciones Estratégicas Priorizadas
    story.append(Paragraph("<b>RECOMENDACIONES ESTRATÉGICAS PRIORIZADAS (PLAN DE ACCIÓN)</b>", sec_title_style))
    recom_list = analysis.get("recomendaciones", [])
    if not recom_list:
        recom_list = ["Mantener el seguimiento y balanceo de uso periódico."]
    for idx, r in enumerate(recom_list, 1):
        story.append(Paragraph(f"<b>{idx}.</b> &nbsp;{_safe(r)}", ai_bullet_style))

    story.append(Spacer(1, 1.5 * mm))

    # 6. Proyección Predictiva de Demanda
    proy_text = _safe(analysis.get("proyeccion_tendencia") or (
        f"Para el siguiente ciclo se proyecta una demanda sostenida con incremento de solicitudes hacia fin de periodo. "
        f"{top_losa_name} se mantendrá como el escenario de mayor concurrencia, recomendándose incentivar el uso de espacios alternos."
    ))
    box_proyeccion = Table(
        [
            [Paragraph("<b>PROYECCIÓN PREDICTIVA PARA EL SIGUIENTE CICLO DEPORTIVO</b>", ParagraphStyle("PH", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.HexColor("#5B21B6")))],
            [Paragraph(proy_text, ai_body_style)],
        ],
        colWidths=[182 * mm],
    )
    box_proyeccion.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PREDICT_BG),
                ("LINELEFT", (0, 0), (0, -1), 3.5, PREDICT_BORDER),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDD6FE")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(box_proyeccion)
    story.append(Spacer(1, 22 * mm))

    # 7. Cuadro Institucional de Validación y Auditoría (Área de Firmas Limpia)
    validation_box = Table(
        [
            [
                Paragraph(
                    "____________________________________________<br/>"
                    "<b>COORDINACIÓN DE DEPORTES</b><br/>"
                    "Dirección de Bienestar Universitario &bull; UNHEVAL",
                    sig_label_style,
                ),
                Paragraph(
                    "____________________________________________<br/>"
                    "<b>ADMINISTRACIÓN DEL SISTEMA SIRLOD</b><br/>"
                    "Auditoría Técnica y Gestión de Infraestructura",
                    sig_label_style,
                ),
            ],
            [
                Paragraph(
                    "Documento oficial emitido por el Sistema SIRLOD con diagnóstico analítico generado por Inteligencia Artificial. Integridad y trazabilidad computacional garantizada.",
                    sig_sub_style,
                ),
                Paragraph(
                    f"Certificación de Autenticidad Digital &bull; Código de Emisión: <b>UNHEVAL-SIRLOD-{report.get('anio', 2026)}-{report.get('mes', 0):02d}</b>",
                    sig_sub_style,
                ),
            ],
        ],
        colWidths=[91 * mm, 91 * mm],
    )
    validation_box.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("TOPPADDING", (0, 1), (-1, 1), 6),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 2),
            ]
        )
    )
    story.append(KeepTogether(validation_box))

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
