from typing import Any


class AppError(Exception):
    """Error de negocio con respuesta HTTP controlada."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        code: str | None = None,
        details: dict[str, Any] | None = None,
        conflicts: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details
        self.conflicts = conflicts
