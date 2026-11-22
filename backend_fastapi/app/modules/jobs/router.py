from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, require_roles
from app.modules.jobs import service
from app.modules.jobs.schemas import JobStatus

router = APIRouter(prefix="/jobs", tags=["Trabajos asíncronos"])
Admin = Annotated[CurrentUser, Depends(require_roles("Administrador"))]


@router.get("/{task_id}", response_model=JobStatus)
def job_status(task_id: UUID, _admin: Admin) -> JobStatus:
    return service.status(task_id)
