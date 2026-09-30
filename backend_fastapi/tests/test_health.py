from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "OK"


def test_openapi_contains_existing_route_prefixes() -> None:
    with TestClient(app) as client:
        document = client.get("/openapi.json").json()
    paths = document["paths"]
    assert "/api/auth/login/usuario" in paths
    assert "/api/permisos/" in paths
    assert "/api/disciplinas/" in paths
    assert "/api/notificaciones/" in paths
    assert "/api/permisos/revision-automatica" in paths
    assert "/api/reportes/resumen" in paths
    assert "/api/reportes/pdf" in paths
    assert "/api/reportes/estado" in paths
    assert "/api/reportes/regenerar" in paths
    assert "delete" in paths["/api/reportes"]
    assert "/api/chatbot/" in paths
    assert sum(len(operations) for operations in paths.values()) == 64
    status_schema = document["components"]["schemas"]["EstadoPermisoIn"]
    assert status_schema["required"] == ["estado"]
    assert "id_t" not in status_schema["properties"]
