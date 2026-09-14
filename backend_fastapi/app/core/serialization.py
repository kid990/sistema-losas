from typing import Any

from sqlalchemy.inspection import inspect


def model_dict(instance: Any, *, exclude: set[str] | None = None) -> dict[str, Any]:
    """Convierte únicamente columnas SQLAlchemy, sin estado interno."""
    hidden = exclude or set()
    return {
        attribute.key: getattr(instance, attribute.key)
        for attribute in inspect(instance).mapper.column_attrs
        if attribute.key not in hidden
    }
