"""Genera permisos Normal/Aceptado historicos (2022-2026) respetando las reglas.

Reglas aplicadas:
- Solo dias habiles (lunes a viernes) dentro de la ventana abril-diciembre.
- Horario 07:00-19:00, bloques de 1 hora.
- Maximo 1 permiso por grupo (escuela + anio_academico) por dia.
- Maximo 3 horas por grupo por semana.
- Sin solapamiento en la misma losa (fecha + hora).

Uso dentro del contenedor backend-fastapi:
    python scripts/seed_permisos_historicos.py --dry-run
    python scripts/seed_permisos_historicos.py --confirm
"""

from __future__ import annotations

import argparse
import asyncio
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert

from app.core.database import engine
from app.integrations.unheval import list_usuarios
from app.models import DetallePermiso, Permiso

ANIO_KEY = "a\u00f1o_academico"
YEARS = (2022, 2023, 2024, 2025, 2026)
CUTOFF_2026 = date(2026, 11, 20)
FIRST_DAY = (4, 15)
LAST_DAY = (12, 15)
OPEN_HOURS = tuple(range(7, 19))  # inicio de bloque 07:00..18:00
BATCH_SIZE = 1000


def _first_monday(value: date) -> date:
    while value.weekday() != 0:
        value += timedelta(days=1)
    return value


def _last_friday(value: date) -> date:
    while value.weekday() != 4:
        value -= timedelta(days=1)
    return value


def build_weeks() -> list[list[date]]:
    """Devuelve las semanas ISO como listas de dias habiles dentro de la ventana."""
    weeks: list[list[date]] = []
    for year in YEARS:
        start = _first_monday(date(year, *FIRST_DAY))
        end = _last_friday(date(year, *LAST_DAY))
        if year == 2026 and end > CUTOFF_2026:
            end = _last_friday(CUTOFF_2026)
        grouped: dict[tuple[int, int], list[date]] = {}
        current = start
        while current <= end:
            if current.weekday() < 5:
                grouped.setdefault(current.isocalendar()[:2], []).append(current)
            current += timedelta(days=1)
        weeks.extend(grouped.values())
    return weeks


def chunks(items: list[Any], size: int) -> list[list[Any]]:
    return [items[start : start + size] for start in range(0, len(items), size)]


async def load_context() -> dict[str, Any]:
    async with engine.connect() as conn:
        rows = (
            await conn.execute(text("SELECT codigo, id_u FROM public.users WHERE rol = 'Alumno'"))
        ).all()
        id_by_codigo = {str(codigo): int(id_u) for codigo, id_u in rows}
        losas = [
            int(row[0])
            for row in (
                await conn.execute(
                    text(
                        """
                        SELECT l.id_l
                        FROM public.losas l
                        JOIN public.disciplinas d ON d.id_d = l.id_d
                        WHERE l.estado = 'Disponible' AND d.estado = 'Activo'
                        ORDER BY l.id_l
                        """
                    )
                )
            ).all()
        ]
        admin_id = (
            await conn.execute(
                text(
                    "SELECT id_t FROM public.trabajadores "
                    "WHERE rol = 'Administrador' AND estado = 'Activo' "
                    "ORDER BY id_t LIMIT 1"
                )
            )
        ).scalar_one_or_none()
        permisos_count = int(
            (await conn.execute(text("SELECT COUNT(*) FROM public.permisos"))).scalar_one()
        )
        detalles_count = int(
            (await conn.execute(text("SELECT COUNT(*) FROM public.detalle_permisos"))).scalar_one()
        )
        base_id = int(
            (
                await conn.execute(text("SELECT COALESCE(MAX(id_p), 0) FROM public.permisos"))
            ).scalar_one()
        )
    return {
        "id_by_codigo": id_by_codigo,
        "losas": losas,
        "admin_id": admin_id,
        "permisos_count": permisos_count,
        "detalles_count": detalles_count,
        "base_id": base_id,
    }


def build_groups(users: list[dict[str, Any]], id_by_codigo: dict[str, int]) -> dict[tuple[str, int], list[str]]:
    groups: dict[tuple[str, int], list[str]] = defaultdict(list)
    for user in users:
        if user.get("rol") != "Alumno":
            continue
        anio = user.get(ANIO_KEY)
        escuela = user.get("escuela")
        codigo = str(user.get("codigo") or "").strip()
        if anio is None or not escuela or not codigo or codigo not in id_by_codigo:
            continue
        groups[(str(escuela), int(anio))].append(codigo)
    for codigos in groups.values():
        codigos.sort()
    return dict(groups)


def build_plan(
    groups: dict[tuple[str, int], list[str]],
    id_by_codigo: dict[str, int],
    losas: list[int],
) -> dict[str, Any]:
    weeks = build_weeks()
    group_keys = sorted(groups)
    group_index = {key: index for index, key in enumerate(group_keys)}
    plans: list[dict[str, Any]] = []
    skipped = 0

    for week_index, days in enumerate(weeks):
        used: set[tuple[date, int, int]] = set()
        shift = week_index % len(group_keys)
        ordered = group_keys[shift:] + group_keys[:shift]
        slots = [(fecha, hour, losa) for fecha in days for hour in OPEN_HOURS for losa in losas]
        total_slots = len(slots)
        for position, group_key in enumerate(ordered):
            offset = (week_index * 37 + position * 53) % total_slots
            chosen = None
            for probe in range(total_slots):
                fecha, hour, losa = slots[(offset + probe) % total_slots]
                key = (fecha, hour, losa)
                if key in used:
                    continue
                used.add(key)
                chosen = key
                break
            if chosen is None:
                skipped += 1
                continue
            fecha, hour, losa = chosen
            codigos = groups[group_key]
            codigo = codigos[(week_index + group_index[group_key]) % len(codigos)]
            plans.append(
                {
                    "group": group_key,
                    "id_u": id_by_codigo[codigo],
                    "fecha": fecha,
                    "hora_inicio": time(hour, 0),
                    "hora_fin": time(hour + 1, 0),
                    "id_l": losa,
                }
            )

    return {"weeks": len(weeks), "groups": len(group_keys), "plans": plans, "skipped": skipped}


def summarize(plan: dict[str, Any]) -> None:
    plans = plan["plans"]
    per_year: dict[int, int] = defaultdict(int)
    per_group: dict[str, int] = defaultdict(int)
    for item in plans:
        per_year[item["fecha"].year] += 1
        per_group[item["group"]] += 1
    print(f"Semanas ISO: {plan['weeks']}")
    print(f"Grupos (escuela + anio_academico): {plan['groups']}")
    print(f"Permisos a generar: {len(plans)}")
    print(f"Omitidos por falta de slot: {plan['skipped']}")
    print("Por anio:", dict(sorted(per_year.items())))
    values = list(per_group.values())
    if values:
        print(f"Por grupo: min={min(values)} max={max(values)}")
    print("Primeros 5:")
    for item in plans[:5]:
        print(
            "  ",
            item["group"],
            item["fecha"].isoformat(),
            item["hora_inicio"].strftime("%H:%M"),
            f"losa={item['id_l']}",
            f"id_u={item['id_u']}",
        )
    print("Ultimos 5:")
    for item in plans[-5:]:
        print(
            "  ",
            item["group"],
            item["fecha"].isoformat(),
            item["hora_inicio"].strftime("%H:%M"),
            f"losa={item['id_l']}",
            f"id_u={item['id_u']}",
        )


async def write_plan(plan: dict[str, Any], context: dict[str, Any]) -> None:
    plans = plan["plans"]
    base_id = context["base_id"]
    admin_id = context["admin_id"]

    permit_rows: list[dict[str, Any]] = []
    detail_rows: list[dict[str, Any]] = []
    for offset, item in enumerate(plans):
        id_p = base_id + offset + 1
        fecha = item["fecha"]
        permit_rows.append(
            {
                "id_p": id_p,
                "id_u": item["id_u"],
                "id_t": None,
                "id_t_decision": admin_id,
                "autor": "Usuario",
                "tipo": "Normal",
                "id_arch": None,
                "duracion_t": 1,
                "estado": "Aceptado",
                "fecha_creacion": datetime.combine(fecha, time(7, 30)),
                "fecha_decision": datetime.combine(fecha, time(7, 35)),
            }
        )
        detail_rows.append(
            {
                "id_p": id_p,
                "id_l": item["id_l"],
                "fecha": fecha,
                "hora_inicio": item["hora_inicio"],
                "hora_fin": item["hora_fin"],
                "duracion": 1,
            }
        )

    async with engine.begin() as conn:
        await conn.execute(text("LOCK TABLE public.permisos, public.detalle_permisos IN EXCLUSIVE MODE"))
        count = int((await conn.execute(text("SELECT COUNT(*) FROM public.permisos"))).scalar_one())
        if count:
            raise SystemExit(
                f"Abortado: public.permisos ya tiene {count} filas. Limpia antes de sembrar."
            )
        for batch in chunks(permit_rows, BATCH_SIZE):
            await conn.execute(insert(Permiso), batch)
        for batch in chunks(detail_rows, BATCH_SIZE):
            await conn.execute(insert(DetallePermiso), batch)
        await conn.execute(
            text("SELECT setval(pg_get_serial_sequence('public.permisos', 'id_p'), :value, true)"),
            {"value": base_id + len(permit_rows)},
        )
    print(f"Insertados: {len(permit_rows)} permisos y {len(detail_rows)} detalles")


async def verify() -> None:
    async with engine.connect() as conn:
        queries = {
            "total_permisos": "SELECT COUNT(*) FROM public.permisos",
            "total_detalles": "SELECT COUNT(*) FROM public.detalle_permisos",
            "por_anio": (
                "SELECT EXTRACT(YEAR FROM d.fecha)::int, COUNT(*) "
                "FROM detalle_permisos d GROUP BY 1 ORDER BY 1"
            ),
            "max_por_grupo_dia": (
                "SELECT COALESCE(MAX(c), 0) FROM ("
                " SELECT u.codigo, p.id_p, d.fecha, COUNT(*) c"
                " FROM permisos p JOIN users u ON u.id_u=p.id_u"
                " JOIN detalle_permisos d ON d.id_p=p.id_p"
                " GROUP BY u.codigo, p.id_p, d.fecha"
                ") t"
            ),
            "max_horas_grupo_semana": (
                "SELECT COALESCE(MAX(h), 0) FROM ("
                " SELECT u.codigo, date_trunc('week', d.fecha), SUM(d.duracion) h"
                " FROM permisos p JOIN users u ON u.id_u=p.id_u"
                " JOIN detalle_permisos d ON d.id_p=p.id_p"
                " GROUP BY u.codigo, date_trunc('week', d.fecha)"
                ") t"
            ),
            "solapes_misma_losa": (
                "SELECT COUNT(*) FROM ("
                " SELECT id_l, fecha, hora_inicio, COUNT(*) c"
                " FROM detalle_permisos GROUP BY id_l, fecha, hora_inicio HAVING COUNT(*) > 1"
                ") t"
            ),
            "fechas_fuera_rango_o_finde": (
                "SELECT COUNT(*) FROM detalle_permisos"
                " WHERE fecha < DATE '2022-04-18' OR fecha > DATE '2026-11-20'"
                " OR EXTRACT(ISODOW FROM fecha) > 5"
            ),
            "horas_fuera_horario": (
                "SELECT COUNT(*) FROM detalle_permisos"
                " WHERE hora_inicio < TIME '07:00' OR hora_fin > TIME '19:00' OR duracion <> 1"
            ),
            "estados": "SELECT estado, tipo, COUNT(*) FROM permisos GROUP BY 1,2 ORDER BY 1,2",
            "por_grupo_minmax": (
                "SELECT MIN(c), MAX(c) FROM ("
                " SELECT u.codigo, COUNT(*) c FROM permisos p"
                " JOIN users u ON u.id_u=p.id_u GROUP BY u.codigo"
                ") t"
            ),
        }
        for name, query in queries.items():
            rows = (await conn.execute(text(query))).all()
            print(f"{name}: {rows}")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Calcula el plan sin escribir")
    group.add_argument("--confirm", action="store_true", help="Escribe el plan en la base")
    args = parser.parse_args()

    context = await load_context()
    if context["permisos_count"] or context["detalles_count"]:
        raise SystemExit(
            "Abortado: ya existen permisos o detalles "
            f"({context['permisos_count']} / {context['detalles_count']})."
        )
    print(
        f"Contexto: alumnos con cuenta={len(context['id_by_codigo'])} "
        f"losas={context['losas']} admin={context['admin_id']}"
    )

    users = await list_usuarios()
    groups = build_groups(users, context["id_by_codigo"])
    if not groups:
        raise SystemExit("Abortado: no se encontraron grupos de alumnos.")
    plan = build_plan(groups, context["id_by_codigo"], context["losas"])
    summarize(plan)

    if args.dry_run:
        print("DRY-RUN: no se escribio nada.")
        await engine.dispose()
        return

    await write_plan(plan, context)
    await verify()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
