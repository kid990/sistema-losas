"""Generación del histórico de reservas con un perfil horario realista.

Reglas del dominio que se respetan (las mismas que valida el backend):

- una sola reserva aceptada por bloque `(losa, fecha, franja)`;
- una reserva aceptada por `(grupo = escuela + año académico, fecha)`;
- máximo 3 horas semanales por grupo y por usuario
  (`configuracion_global.max_horas_semana`);
- un bloque dura 1 hora y solo hay 12 franjas (07:00 a 19:00).

El resultado es determinista para una semilla dada.
"""

from __future__ import annotations

import random
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

HOURS = list(range(7, 19))
HOUR_PROFILE = {
    7: 0.30,
    8: 0.32,
    9: 0.40,
    10: 0.50,
    11: 0.58,
    12: 0.66,
    13: 0.72,
    14: 0.78,
    15: 0.84,
    16: 0.88,
    17: 0.90,
    18: 0.88,
}
DOW_FACTOR = {0: 1.05, 1: 1.00, 2: 0.95, 3: 1.00, 4: 0.85}
LOSA_FACTOR = {1: 1.15, 2: 1.15, 3: 1.00, 4: 0.95, 5: 0.70}
BANDS = {
    "libre": tuple(HOURS),
    "tarde": (14, 15, 16, 17, 18),
    "noche": (16, 17, 18),
    "manana": (7, 8, 9, 10, 11),
}
BAND_WEIGHTS = {"libre": 45, "tarde": 25, "noche": 20, "manana": 10}
QUOTA_CHOICES = ((2, 55), (5, 27), (9, 14), (20, 3), (45, 1))
WEEKLY_LIMIT = 3
CANCEL_RATE = 0.10

Slot = tuple[date, int, int]


@dataclass(frozen=True)
class UserProfile:
    id_u: int
    grupo: str
    quota: int
    band: tuple[int, ...]
    fav_losa: int = 0

    @property
    def heavy(self) -> bool:
        return self.quota >= 20


@dataclass
class Reserva:
    id_u: int
    grupo: str
    fecha: date
    hora: int
    id_l: int
    estado: str
    creado_en: datetime
    decidido_en: datetime


@dataclass
class GenerationResult:
    reservas: list[Reserva]
    ocupacion_por_hora: dict[int, float]
    ocupacion_por_dia: dict[int, float]
    ocupacion_por_losa: dict[int, float]
    usuarios_activos: int
    usuarios_heavy: int
    canceladas: int
    bloques_libres_sin_relleno: int
    dias: int
    bloques: int

    @property
    def aceptadas(self) -> int:
        return sum(1 for r in self.reservas if r.estado == "Aceptado")

    @property
    def ocupacion(self) -> float:
        return self.aceptadas / self.bloques if self.bloques else 0.0


def _quota(rng: random.Random) -> int:
    population = [q for q, _ in QUOTA_CHOICES]
    weights = [w for _, w in QUOTA_CHOICES]
    return rng.choices(population, weights=weights, k=1)[0]


def build_profiles(usuarios: list[tuple[int, str]], rng: random.Random) -> list[UserProfile]:
    bands = list(BAND_WEIGHTS)
    band_weights = list(BAND_WEIGHTS.values())
    profiles = []
    for id_u, grupo in usuarios:
        quota = _quota(rng)
        band = "noche" if quota >= 20 else rng.choices(bands, weights=band_weights, k=1)[0]
        fav_losa = rng.randint(1, 5) if quota >= 20 else 0
        profiles.append(UserProfile(id_u, grupo, quota, BANDS[band], fav_losa))
    return profiles


def _probabilities(
    dias: list[date], losas: list[int], target: float, rng: random.Random
) -> dict[Slot, float]:
    ruido = {d: min(1.18, max(0.82, rng.gauss(1.0, 0.07))) for d in dias}
    values: dict[Slot, float] = {}
    for fecha in dias:
        base = DOW_FACTOR[fecha.weekday()] * ruido[fecha]
        for id_l in losas:
            for hora in HOURS:
                values[(fecha, hora, id_l)] = HOUR_PROFILE[hora] * base * LOSA_FACTOR[id_l]

    for _ in range(5):
        factor = target / statistics.fmean(values.values())
        for slot, value in values.items():
            values[slot] = min(0.985, max(0.01, value * factor))
    return values


def _sample_slots(values: dict[Slot, float], target: float, rng: random.Random) -> list[Slot]:
    objetivo = round(target * len(values))
    ocupados = [slot for slot, p in values.items() if rng.random() < p]
    libres = [slot for slot in values if slot not in set(ocupados)]
    rng.shuffle(ocupados)
    rng.shuffle(libres)
    while len(ocupados) > objetivo and ocupados:
        ocupados.pop()
    while len(ocupados) < objetivo and libres:
        ocupados.append(libres.pop())
    return ocupados


def _times(fecha: date, rng: random.Random) -> tuple[datetime, datetime, int]:
    lead = rng.choices([1, 2, 3, 4, 5, 6, 7], weights=[28, 22, 16, 12, 9, 7, 6], k=1)[0]
    creado = datetime.combine(
        fecha - timedelta(days=lead),
        time(rng.randint(7, 18), rng.choice([0, 5, 10, 15, 20, 25, 30, 40, 45, 50])),
    )
    decidido = creado + timedelta(minutes=rng.choice([2, 3, 5, 8, 12, 20, 35, 60, 90]))
    return creado, decidido, lead


def _cancel_time(fecha: date, creado: datetime, rng: random.Random) -> datetime:
    limite = datetime.combine(fecha, time(6, 30))
    inicio = min(max(creado + timedelta(minutes=20), creado), limite - timedelta(minutes=1))
    span = int((limite - inicio).total_seconds() // 60)
    if span <= 5:
        return limite - timedelta(minutes=1)
    return inicio + timedelta(minutes=rng.randint(1, span - 1))


def generate(
    dias: list[date],
    losas: list[int],
    usuarios: list[tuple[int, str]],
    target: float = 0.65,
    seed: int = 20261122,
) -> GenerationResult:
    rng = random.Random(seed)
    profiles = build_profiles(usuarios, rng)
    values = _probabilities(dias, losas, target, rng)
    slots = _sample_slots(values, target, rng)

    by_hour: dict[int, list[Slot]] = defaultdict(list)
    for fecha, hora, id_l in slots:
        by_hour[hora].append((fecha, hora, id_l))
    for lista in by_hour.values():
        rng.shuffle(lista)

    user_dates: set[tuple[int, date]] = set()
    group_dates: set[tuple[str, date]] = set()
    user_week: dict[tuple[int, int, int], int] = defaultdict(int)
    group_week: dict[tuple[str, int, int], int] = defaultdict(int)
    asignadas: dict[int, int] = defaultdict(int)
    taken: list[tuple[UserProfile, Slot]] = []

    def allowed(profile: UserProfile, fecha: date) -> bool:
        if (profile.id_u, fecha) in user_dates:
            return False
        if (profile.grupo, fecha) in group_dates:
            return False
        iso = fecha.isocalendar()
        anio, semana = iso[0], iso[1]
        if user_week[(profile.id_u, anio, semana)] >= WEEKLY_LIMIT:
            return False
        if group_week[(profile.grupo, anio, semana)] >= WEEKLY_LIMIT:
            return False
        return True

    def attempt(profile: UserProfile, hora: int, tries: int = 4) -> Slot | None:
        lista = by_hour[hora]
        if not lista:
            return None
        for _ in range(min(tries, len(lista))):
            index = rng.randrange(len(lista))
            slot = lista[index]
            fecha, _, id_l = slot
            if profile.heavy and id_l != profile.fav_losa and rng.random() > 0.15:
                continue
            if not allowed(profile, fecha):
                continue
            lista[index] = lista[-1]
            lista.pop()
            iso = fecha.isocalendar()
            user_dates.add((profile.id_u, fecha))
            group_dates.add((profile.grupo, fecha))
            user_week[(profile.id_u, iso[0], iso[1])] += 1
            group_week[(profile.grupo, iso[0], iso[1])] += 1
            asignadas[profile.id_u] += 1
            taken.append((profile, slot))
            return slot
        return None

    def take(profile: UserProfile) -> Slot | None:
        horas = list(profile.band)
        rng.shuffle(horas)
        for hora in horas:
            slot = attempt(profile, hora)
            if slot is not None:
                return slot
        disponibles = [h for h in HOURS if by_hour[h]]
        rng.shuffle(disponibles)
        for hora in disponibles[:4]:
            slot = attempt(profile, hora)
            if slot is not None:
                return slot
        return None

    rng.shuffle(profiles)
    max_quota = max(profile.quota for profile in profiles)
    for ronda in range(1, max_quota + 1):
        for profile in profiles:
            if profile.quota < ronda or asignadas[profile.id_u] >= profile.quota:
                continue
            take(profile)

    reservas: list[Reserva] = []
    detalles: list[tuple[UserProfile, Slot, datetime, datetime, int]] = []
    for profile, slot in taken:
        creado, decidido, lead = _times(slot[0], rng)
        detalles.append((profile, slot, creado, decidido, lead))

    total = len(detalles)
    a_cancelar = round(CANCEL_RATE * total)
    pesos = []
    for profile, slot, creado, decidido, lead in detalles:
        peso = 1.0 + lead / 7 + (0.8 if slot[1] <= 10 else 0.0)
        pesos.append(rng.random() ** (1.0 / peso))
    elegidos = set(sorted(range(total), key=lambda i: pesos[i], reverse=True)[:a_cancelar])

    relleno: list[Slot] = []
    for index, (profile, slot, creado, decidido, lead) in enumerate(detalles):
        if index in elegidos:
            reservas.append(
                Reserva(
                    profile.id_u,
                    profile.grupo,
                    slot[0],
                    slot[1],
                    slot[2],
                    "Cancelado",
                    creado,
                    _cancel_time(slot[0], creado, rng),
                )
            )
            relleno.append(slot)
        else:
            reservas.append(
                Reserva(
                    profile.id_u,
                    profile.grupo,
                    slot[0],
                    slot[1],
                    slot[2],
                    "Aceptado",
                    creado,
                    decidido,
                )
            )

    # Reasignar los bloques liberados por cancelaciones con otros usuarios.
    sobrantes = [p for p in profiles if asignadas[p.id_u] < p.quota]
    sin_relleno = 0
    for slot in relleno:
        fecha, hora, id_l = slot
        colocado = False
        for _ in range(80):
            if not sobrantes:
                break
            profile = rng.choice(sobrantes)
            if profile.heavy and id_l != profile.fav_losa and rng.random() > 0.15:
                continue
            if not allowed(profile, fecha):
                continue
            iso = fecha.isocalendar()
            user_dates.add((profile.id_u, fecha))
            group_dates.add((profile.grupo, fecha))
            user_week[(profile.id_u, iso[0], iso[1])] += 1
            group_week[(profile.grupo, iso[0], iso[1])] += 1
            asignadas[profile.id_u] += 1
            creado, decidido, _ = _times(fecha, rng)
            reservas.append(
                Reserva(profile.id_u, profile.grupo, fecha, hora, id_l, "Aceptado", creado, decidido)
            )
            colocado = True
            break
        if not colocado:
            sin_relleno += 1

    aceptadas = [r for r in reservas if r.estado == "Aceptado"]
    dias_por_dow = Counter(d.weekday() for d in dias)
    por_hora = {h: [0, len(dias) * len(losas)] for h in HOURS}
    por_dia = {d: [0, total * len(losas) * len(HOURS)] for d, total in dias_por_dow.items()}
    por_losa = {l: [0, len(dias) * len(HOURS)] for l in losas}
    for r in aceptadas:
        por_hora[r.hora][0] += 1
        por_dia[r.fecha.weekday()][0] += 1
        por_losa[r.id_l][0] += 1

    return GenerationResult(
        reservas=reservas,
        ocupacion_por_hora={h: n / d for h, (n, d) in por_hora.items() if d},
        ocupacion_por_dia={d: n / t for d, (n, t) in por_dia.items() if t},
        ocupacion_por_losa={l: n / t for l, (n, t) in por_losa.items() if t},
        usuarios_activos=len({r.id_u for r in reservas}),
        usuarios_heavy=sum(1 for p in profiles if p.heavy),
        canceladas=sum(1 for r in reservas if r.estado == "Cancelado"),
        bloques_libres_sin_relleno=sin_relleno,
        dias=len(dias),
        bloques=len(dias) * len(losas) * len(HOURS),
    )
