import asyncio
from collections import defaultdict, deque
from time import monotonic


class SlidingWindowLimiter:
    """Limitador en memoria para una instancia del servidor."""

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        """Registra la petición y devuelve si permanece dentro del límite."""
        now = monotonic()
        async with self._lock:
            events = self._events[key]
            threshold = now - window_seconds
            while events and events[0] <= threshold:
                events.popleft()
            if len(events) >= limit:
                return False
            events.append(now)
            return True

    async def clear(self, key: str) -> None:
        async with self._lock:
            self._events.pop(key, None)


limiter = SlidingWindowLimiter()
