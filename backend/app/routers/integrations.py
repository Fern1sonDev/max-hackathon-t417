"""Connections to external systems (ATS, job boards, university LMS/ERP).

Organisations register a connection in the cabinet; secrets are validated
for presence but never stored. Data exchange for each connector is enabled
at the pilot stage — see app/integrations/connectors.py.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.integrations import BY_ID, CATEGORY_LABEL, CONNECTORS, ConnectorSpec
from app.models import IntegrationConnection
from app.schemas import ErrorOut, IntegrationConnectIn, IntegrationFieldOut, IntegrationOut

router = APIRouter(prefix="/api", tags=["integrations"])

STATUS_LABEL = {"pending": "Подключение настроено · обмен данными включается на пилоте"}


def _out(spec: ConnectorSpec, conn: IntegrationConnection | None) -> IntegrationOut:
    return IntegrationOut(
        id=spec.id, name=spec.name, vendor=spec.vendor, category=spec.category, category_label=CATEGORY_LABEL[spec.category],
        summary=spec.summary, capabilities=list(spec.capabilities), auth=spec.auth, docs=spec.docs,
        fields=[IntegrationFieldOut(key=f.key, label=f.label, placeholder=f.placeholder, secret=f.secret, required=f.required) for f in spec.fields],
        connected=conn is not None, status=conn.status if conn else None, status_label=STATUS_LABEL.get(conn.status, "") if conn else "",
        settings=json.loads(conn.settings or "{}") if conn else {}, connected_at=conn.created_at if conn else None,
    )


def _spec_for(current: dict, connector_id: str) -> ConnectorSpec:
    spec = BY_ID.get(connector_id)
    if not spec or current["role"] not in spec.roles:
        raise HTTPException(status_code=404, detail="Connector not found")
    return spec


@router.get("/integrations", response_model=list[IntegrationOut], summary="Доступные интеграции и статус подключения организации")
def list_integrations(current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "hr", "curator", detail="Integrations are available to organisations")
    connections = {c.connector_id: c for c in db.query(IntegrationConnection).filter(IntegrationConnection.org_id == current["org_id"])}
    return [_out(spec, connections.get(spec.id)) for spec in CONNECTORS if current["role"] in spec.roles]


@router.put("/integrations/{connector_id}", response_model=IntegrationOut, summary="Подключить внешнюю систему (секреты не сохраняются)", responses={404: {"model": ErrorOut}, 422: {"model": ErrorOut}})
def connect_integration(connector_id: str, payload: IntegrationConnectIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "hr", "curator", detail="Integrations are available to organisations")
    spec = _spec_for(current, connector_id)
    stored: dict[str, str] = {}
    for f in spec.fields:
        value = (payload.settings.get(f.key) or "").strip()
        if f.required and not value:
            raise HTTPException(status_code=422, detail=f"Field '{f.label}' is required")
        if len(value) > 300:
            raise HTTPException(status_code=422, detail=f"Field '{f.label}' is too long")
        # Secrets are checked for presence only and never persisted.
        stored[f.key] = ("••••" + value[-4:]) if f.secret and value else value
    conn = db.query(IntegrationConnection).filter(IntegrationConnection.org_id == current["org_id"], IntegrationConnection.connector_id == spec.id).first()
    if not conn:
        conn = IntegrationConnection(org_id=current["org_id"], connector_id=spec.id)
        db.add(conn)
    conn.status = "pending"
    conn.settings = json.dumps(stored, ensure_ascii=False)
    db.commit()
    db.refresh(conn)
    return _out(spec, conn)


@router.delete("/integrations/{connector_id}", status_code=204, summary="Отключить внешнюю систему", responses={404: {"model": ErrorOut}})
def disconnect_integration(connector_id: str, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "hr", "curator", detail="Integrations are available to organisations")
    spec = _spec_for(current, connector_id)
    db.query(IntegrationConnection).filter(IntegrationConnection.org_id == current["org_id"], IntegrationConnection.connector_id == spec.id).delete()
    db.commit()
    return Response(status_code=204)
