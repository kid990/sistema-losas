"""Regenera el histórico de reservas de las tablas reales.

Uso:
    python -m ml.seed_historico --dry-run        # solo calcula y muestra el reporte
    python -m ml.seed_historico --apply --yes    # respalda y reescribe la BD
    python -m ml.seed_historico --rollback --yes # restaura el respaldo

Los datos generados son sintéticos (perfil horario realista) y se escriben en
`permisos`, `detalle_permisos` y `notificacion`. Antes de escribir se crean
tablas `*_bak_AAAAMMDD` para poder volver atrás.
"""

from __future__ import annotations

import argparse
import random
import sys
from collections import Counter
from datetime import date, datetime, time, timedelta

import psycopg

from ml.losa_ml import db, padron, synthetic

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BACKUP_SUFFIX = "bak_20261122"
ESTADOS = ("Aceptado", "Cancelado")


def feriados(desde: date, hasta: date) -> set[date]:
    """Feriados nacionales peruanos entre dos fechas."""
    fijos = [
        (1, 1),
        (5, 1),
        (6, 7),
        (6, 29),
        (7, 23),
        (7, 28),
        (7, 29),
        (8, 6),
        (8, 30),
        (10, 8),
        (11, 1),
        (12, 8),
        (12, 9),
        (12, 25),
    ]
    dias: set[date] = set()
    for anio in range(desde.year, hasta.year + 1):
        for mes, dia in fijos:
            dias.add(date(anio, mes, dia))
        pascua = _pascua(anio)
        dias.add(pascua - timedelta(days=3))  # Jueves Santo
        dias.add(pascua - timedelta(days=2))  # Viernes Santo
    return {d for d in dias if desde <= d <= hasta}


def _pascua(anio: int) -> date:
    a = anio % 19
    b, c = divmod(anio, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes, dia = divmod(h + l - 7 * m + 114, 31)
    return date(anio, mes, dia + 1)


def _pct(value: float) -> str:
    return f"{value * 100:5.1f}%"


def _reporte(result: synthetic.GenerationResult) -> None:
    print("\n== Ocupación por franja (bloques aceptados) ==")
    for hora, valor in sorted(result.ocupacion_por_hora.items()):
        barra = "#" * round(valor * 40)
        print(f"  {hora:02d}:00 {_pct(valor)} {barra}")

    nombres = ["lunes", "martes", "miércoles", "jueves", "viernes"]
    print("\n== Ocupación por día ==")
    for dia, valor in sorted(result.ocupacion_por_dia.items()):
        print(f"  {nombres[dia]:<10} {_pct(valor)}")

    print("\n== Ocupación por losa ==")
    for id_l, valor in sorted(result.ocupacion_por_losa.items()):
        print(f"  Losa {id_l:02d}    {_pct(valor)}")

    print("\n== Resumen ==")
    print(f"  días                  : {result.dias}")
    print(f"  bloques totales       : {result.bloques}")
    print(f"  reservas aceptadas    : {result.aceptadas}  ({_pct(result.ocupacion)} de ocupación)")
    print(f"  reservas canceladas   : {result.canceladas}")
    print(f"  usuarios con reservas : {result.usuarios_activos}")
    print(f"  usuarios acaparadores : {result.usuarios_heavy} (cuota >= 20)")
    print(f"  bloques sin relleno   : {result.bloques_libres_sin_relleno}")


def _cargar_contexto(conn: psycopg.Connection) -> tuple[list[date], list[int], list[tuple[int, str]]]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT fecha FROM detalle_permisos "
            "WHERE extract(isodow FROM fecha) < 6 ORDER BY fecha"
        )
        dias = [row[0] for row in cur.fetchall()]

        cur.execute("SELECT id_l FROM losas WHERE estado = 'Disponible' ORDER BY id_l")
        losas = [row[0] for row in cur.fetchall()]

        cur.execute("SELECT id_u, codigo FROM users WHERE rol = 'Alumno' AND estado = 'Activo'")
        usuarios_db = cur.fetchall()

    mapa = padron.load_padron()
    usuarios: list[tuple[int, str]] = []
    sin_padron = 0
    for id_u, codigo in usuarios_db:
        datos = mapa.get(codigo)
        if datos is None:
            sin_padron += 1
            grupo = f"ZZ-{codigo[:6]}"
        else:
            grupo = f"{datos[0]}|{datos[1]}"
        usuarios.append((id_u, grupo))
    if sin_padron:
        print(f"  aviso: {sin_padron} usuarios sin padrón, agrupados por prefijo de código")
    return dias, losas, usuarios


def _hijos(conn: psycopg.Connection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT tc.table_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                 ON kcu.constraint_name = tc.constraint_name
            JOIN information_schema.constraint_column_usage ccu
                 ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND ccu.table_name = 'permisos'
              AND tc.table_name NOT IN ('detalle_permisos', 'notificacion')
            """
        )
        return [row[0] for row in cur.fetchall()]


def _respaldo(cur: psycopg.Cursor, tabla: str) -> str:
    destino = f"{tabla}_{BACKUP_SUFFIX}"
    cur.execute("SELECT to_regclass(%s)", (destino,))
    if cur.fetchone()[0] is None:
        cur.execute(f"CREATE TABLE {destino} AS SELECT * FROM {tabla}")
        cur.execute(f"SELECT count(*) FROM {destino}")
        print(f"  respaldo {destino}: {cur.fetchone()[0]} filas")
    else:
        print(f"  respaldo {destino}: ya existía, se conserva")
    return destino


def _secuencia(cur: psycopg.Cursor, tabla: str, columna: str) -> None:
    cur.execute(
        "SELECT setval(pg_get_serial_sequence(%s, %s), "
        f"(SELECT coalesce(max({columna}), 0) FROM {tabla}), true)",
        (tabla, columna),
    )


def _insertar(
    conn: psycopg.Connection, result: synthetic.GenerationResult, seed: int
) -> None:
    rng = random.Random(seed + 1)
    with conn.cursor() as cur:
        hijos = _hijos(conn)
        for tabla in hijos:
            _respaldo(cur, tabla)
        _respaldo(cur, "notificacion")
        _respaldo(cur, "detalle_permisos")
        _respaldo(cur, "permisos")

        for tabla in hijos:
            cur.execute(f"DELETE FROM {tabla}")
        cur.execute("DELETE FROM notificacion")
        cur.execute("DELETE FROM detalle_permisos")
        cur.execute("DELETE FROM permisos")

        permisos = []
        detalles = []
        notificaciones = []
        for numero, reserva in enumerate(result.reservas, start=1):
            fin = reserva.hora + 1
            permisos.append(
                (
                    numero,
                    reserva.id_u,
                    None,
                    None,
                    "Usuario",
                    "Normal",
                    None,
                    1,
                    reserva.estado,
                    reserva.creado_en,
                    reserva.decidido_en,
                )
            )
            detalles.append(
                (
                    numero,
                    numero,
                    reserva.id_l,
                    reserva.fecha,
                    time(reserva.hora, 0),
                    time(fin, 0),
                    1,
                )
            )
            if reserva.estado == "Aceptado":
                mensaje = (
                    f"Tu permiso #{numero} para la losa {reserva.id_l:02d} del "
                    f"{reserva.fecha.isoformat()} ({reserva.hora:02d}:00-{fin:02d}:00) "
                    "fue aceptado."
                )
            else:
                mensaje = (
                    f"Tu permiso #{numero} para la losa {reserva.id_l:02d} del "
                    f"{reserva.fecha.isoformat()} fue cancelado."
                )
            notificaciones.append(
                (numero, mensaje, reserva.decidido_en, reserva.estado, numero, rng.random() < 0.7)
            )

        with cur.copy(
            "COPY permisos (id_p, id_u, id_t, id_t_decision, autor, tipo, id_arch, "
            "duracion_t, estado, fecha_creacion, fecha_decision) FROM STDIN"
        ) as copy:
            for fila in permisos:
                copy.write_row(fila)
        with cur.copy(
            "COPY detalle_permisos (id_d, id_p, id_l, fecha, hora_inicio, hora_fin, duracion) "
            "FROM STDIN"
        ) as copy:
            for fila in detalles:
                copy.write_row(fila)
        with cur.copy(
            "COPY notificacion (id_n, mensaje, fecha_envio, tipo, id_p, leido) FROM STDIN"
        ) as copy:
            for fila in notificaciones:
                copy.write_row(fila)

        _secuencia(cur, "permisos", "id_p")
        _secuencia(cur, "detalle_permisos", "id_d")
        _secuencia(cur, "notificacion", "id_n")


def _feriados_bd(conn: psycopg.Connection, dias: set[date]) -> None:
    with conn.cursor() as cur:
        for fecha in sorted(dias):
            cur.execute(
                "INSERT INTO dias_bloqueados (fecha, motivo) VALUES (%s, %s) "
                "ON CONFLICT (fecha) DO NOTHING",
                (fecha, "Feriado nacional"),
            )


def _validar(conn: psycopg.Connection, bloques: int) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT estado, count(*) FROM permisos GROUP BY 1 ORDER BY 2 DESC")
        print("\n== Validación ==")
        for estado, total in cur.fetchall():
            print(f"  permisos {estado}: {total}")

        cur.execute("SELECT count(*) FROM permisos p FULL JOIN detalle_permisos d USING (id_p) WHERE p.id_p IS NULL OR d.id_p IS NULL")
        print(f"  permisos sin detalle: {cur.fetchone()[0]}")

        cur.execute(
            "SELECT count(*) FROM ("
            "  SELECT d.fecha, d.hora_inicio, d.id_l FROM detalle_permisos d "
            "  JOIN permisos p ON p.id_p = d.id_p WHERE p.estado = 'Aceptado' "
            "  GROUP BY 1, 2, 3 HAVING count(*) > 1"
            ") duplicados"
        )
        print(f"  bloques duplicados: {cur.fetchone()[0]}")

        cur.execute(
            "SELECT count(*) FROM ("
            "  SELECT p.id_u, d.fecha FROM permisos p JOIN detalle_permisos d ON d.id_p = p.id_p "
            "  WHERE p.estado = 'Aceptado' GROUP BY 1, 2 HAVING count(*) > 1"
            ") x"
        )
        print(f"  usuarios con 2 reservas el mismo día: {cur.fetchone()[0]}")

        cur.execute(
            "SELECT coalesce(max(total), 0) FROM ("
            "  SELECT sum(d.duracion) AS total FROM permisos p "
            "  JOIN detalle_permisos d ON d.id_p = p.id_p "
            "  WHERE p.estado = 'Aceptado' "
            "  GROUP BY p.id_u, date_trunc('week', d.fecha)"
            ") x"
        )
        print(f"  máximo de horas por usuario/semana: {cur.fetchone()[0]}")

        cur.execute("SELECT count(*) FROM dias_bloqueados")
        print(f"  días bloqueados (feriados): {cur.fetchone()[0]}")

        cur.execute("SELECT count(*) FROM permisos WHERE estado = 'Aceptado'")
        aceptadas = cur.fetchone()[0]
        print(f"  ocupación global: {_pct(aceptadas / bloques)}")


def _rollback(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        for tabla, columna in (
            ("notificacion", "id_n"),
            ("detalle_permisos", "id_d"),
            ("permisos", "id_p"),
        ):
            origen = f"{tabla}_{BACKUP_SUFFIX}"
            cur.execute("SELECT to_regclass(%s)", (origen,))
            if cur.fetchone()[0] is None:
                raise SystemExit(f"Falta el respaldo {origen}")
        for tabla in ("notificacion", "detalle_permisos", "permisos"):
            cur.execute(f"DELETE FROM {tabla}")
            cur.execute(f"INSERT INTO {tabla} SELECT * FROM {tabla}_{BACKUP_SUFFIX}")
        _secuencia(cur, "permisos", "id_p")
        _secuencia(cur, "detalle_permisos", "id_d")
        _secuencia(cur, "notificacion", "id_n")
        for tabla in ("notificacion", "detalle_permisos", "permisos"):
            cur.execute(f"SELECT count(*) FROM {tabla}")
            print(f"  {tabla}: {cur.fetchone()[0]} filas restauradas")


def _verificar(result: synthetic.GenerationResult) -> None:
    """Comprueba en memoria que se respetan las reglas del backend."""
    bloques: set[tuple[date, int, int]] = set()
    usuarios: set[tuple[int, date]] = set()
    grupos: set[tuple[str, date]] = set()
    horas_usuario: Counter[tuple[int, int, int]] = Counter()
    horas_grupo: Counter[tuple[str, int, int]] = Counter()
    for r in result.reservas:
        if r.estado != "Aceptado":
            continue
        bloque = (r.fecha, r.hora, r.id_l)
        if bloque in bloques:
            raise SystemExit(f"Bloque duplicado: {bloque}")
        bloques.add(bloque)
        if (r.id_u, r.fecha) in usuarios:
            raise SystemExit(f"Usuario duplicado el mismo día: {r.id_u} {r.fecha}")
        usuarios.add((r.id_u, r.fecha))
        if (r.grupo, r.fecha) in grupos:
            raise SystemExit(f"Grupo duplicado el mismo día: {r.grupo} {r.fecha}")
        grupos.add((r.grupo, r.fecha))
        iso = r.fecha.isocalendar()
        horas_usuario[(r.id_u, iso[0], iso[1])] += 1
        horas_grupo[(r.grupo, iso[0], iso[1])] += 1
    max_usuario = max(horas_usuario.values(), default=0)
    max_grupo = max(horas_grupo.values(), default=0)
    if max_usuario > synthetic.WEEKLY_LIMIT or max_grupo > synthetic.WEEKLY_LIMIT:
        raise SystemExit(f"Cuota semanal excedida: usuario={max_usuario} grupo={max_grupo}")
    print(
        f"  verificación: {len(bloques)} bloques únicos, "
        f"{max_usuario} h/semana por usuario, {max_grupo} h/semana por grupo"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modo = parser.add_mutually_exclusive_group()
    modo.add_argument("--dry-run", action="store_true", help="solo genera y muestra el reporte")
    modo.add_argument("--apply", action="store_true", help="respalda y reescribe las tablas")
    modo.add_argument("--rollback", action="store_true", help="restaura el respaldo")
    parser.add_argument("--target", type=float, default=0.65, help="ocupación objetivo (0-1)")
    parser.add_argument("--seed", type=int, default=20261122)
    parser.add_argument("--yes", action="store_true", help="confirma la escritura")
    args = parser.parse_args()

    if args.apply or args.rollback:
        if not args.yes:
            raise SystemExit("Operación destructiva: agrega --yes para confirmar")
    else:
        args.dry_run = True

    print(f"Conectando a {db.describe_target()}")
    with db.connect() as conn:
        conn.autocommit = False
        if args.rollback:
            _rollback(conn)
            conn.commit()
            print("Rollback completado.")
            return 0

        dias, losas, usuarios = _cargar_contexto(conn)
        festivos = feriados(dias[0], dias[-1])
        dias = [d for d in dias if d not in festivos]
        print(
            f"  {len(dias)} días hábiles, {len(losas)} losas, {len(usuarios)} alumnos, "
            f"{len(festivos)} feriados excluidos"
        )

        result = synthetic.generate(dias, losas, usuarios, target=args.target, seed=args.seed)
        _verificar(result)
        _reporte(result)

        if args.dry_run:
            print("\nDry-run: no se escribió nada. Usa --apply --yes para aplicar.")
            return 0

        _feriados_bd(conn, festivos)
        _insertar(conn, result, args.seed)
        conn.commit()
        print("\nEscritura confirmada.")
        _validar(conn, result.bloques)
    return 0


if __name__ == "__main__":
    sys.exit(main())
