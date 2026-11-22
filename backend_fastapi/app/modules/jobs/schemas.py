from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class JobQueued(BaseModel):
    success: bool = True
    task_id: UUID
    state: str = "PENDING"
    status_url: str


class JobStatus(BaseModel):
    success: bool = True
    task_id: UUID
    state: str
    ready: bool
    result: Any | None = None
    error: str | None = Field(default=None, max_length=1000)
