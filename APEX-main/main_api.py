import os
import json
from datetime import datetime
import re
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from typing import Optional, List
import psycopg2
from dotenv import load_dotenv
from supabase import create_client, Client
import base64
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from io import BytesIO
from fastapi.responses import StreamingResponse
from fastapi.responses import JSONResponse
import requests

load_dotenv()

app = FastAPI(title="APEX ERP API", version="2.0")

# ============================================================
# MIDDLEWARE: COMPRESIÓN GZIP (Reduce transferencia 70%)
# ============================================================
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ============================================================
# MIDDLEWARE: CORS
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# CONEXION A BASE DE DATOS (igual que tu db_manager.py)
# ============================================================
from psycopg2 import pool as pg_pool

# Connection pool - reutiliza conexiones en vez de abrir una nueva por request
_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=20,
            host=os.getenv("DB_HOST"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASS"),
            port="6543",
            connect_timeout=10
        )
    return _pool

def get_conn():
    return get_pool().getconn()

def release_conn(conn):
    if conn is None:
        return
    try:
        if not conn.closed:
            try:
                conn.rollback()
            except Exception:
                pass
        get_pool().putconn(conn)
    except Exception:
        try:
            conn.close()
        except Exception:
            pass

# ============================================================
# SUPABASE STORAGE CONFIGURATION
# ============================================================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = "fotos-servicios"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

PERMISSION_CATALOG = {
    "dashboard": ["access", "view"],
    "personal": ["access", "view", "create", "edit"],
    "roles": ["access", "view", "create", "edit"],
    "servicios": ["access", "view", "create", "edit", "export"],
    "horarios": ["access", "view", "create", "edit", "approve"],
    "vehiculos": ["access", "view", "create", "edit"],
    "referencias": ["access", "view", "create", "edit"],
    "reportes": ["access", "view", "export"],
}

SYSTEM_ROLE_TEMPLATES = [
    {
        "codigo": "admin",
        "nombre": "Administrador",
        "descripcion": "Acceso completo a toda la plataforma.",
        "activo": True,
        "es_sistema": True,
        "permisos": "FULL",
    },
    {
        "codigo": "tecnico",
        "nombre": "Tecnico",
        "descripcion": "Ejecuta servicios, consulta referencias y registra trabajo de campo.",
        "activo": True,
        "es_sistema": True,
        "permisos": {
            "dashboard": {"access": True, "view": True},
            "servicios": {"access": True, "view": True, "edit": True, "export": True},
            "horarios": {"access": True, "view": True, "create": True, "edit": True},
            "vehiculos": {"access": True, "view": True},
            "referencias": {"access": True, "view": True},
        },
    },
    {
        "codigo": "empleado",
        "nombre": "Empleado",
        "descripcion": "Consulta operativa y registro de jornada.",
        "activo": True,
        "es_sistema": True,
        "permisos": {
            "dashboard": {"access": True, "view": True},
            "horarios": {"access": True, "view": True, "create": True},
            "vehiculos": {"access": True, "view": True},
        },
    },
    {
        "codigo": "coordinador",
        "nombre": "Coordinador",
        "descripcion": "Gestiona operacion, catalogos y reportes sin administrar perfiles.",
        "activo": True,
        "es_sistema": True,
        "permisos": {
            "dashboard": {"access": True, "view": True},
            "personal": {"access": True, "view": True, "create": True, "edit": True},
            "servicios": {"access": True, "view": True, "create": True, "edit": True, "export": True},
            "horarios": {"access": True, "view": True, "create": True, "edit": True, "approve": True},
            "vehiculos": {"access": True, "view": True, "create": True, "edit": True},
            "referencias": {"access": True, "view": True, "create": True, "edit": True},
            "reportes": {"access": True, "view": True, "export": True},
        },
    },
]

PERMISSION_RULES = [
    ({"GET"}, r"^/personal$", "personal", "view"),
    ({"POST"}, r"^/personal$", "personal", "create"),
    ({"PUT", "PATCH"}, r"^/personal/\d+", "personal", "edit"),
    ({"GET"}, r"^/roles$", "roles", "view"),
    ({"POST"}, r"^/roles$", "roles", "create"),
    ({"PUT", "PATCH"}, r"^/roles/\d+", "roles", "edit"),
    ({"GET"}, r"^/vehiculos$", "vehiculos", "view"),
    ({"POST", "PUT", "PATCH"}, r"^/vehiculos(?:/.*)?$", "vehiculos", "edit"),
    ({"GET"}, r"^/rutas$", "horarios", "view"),
    ({"POST"}, r"^/rutas$", "horarios", "create"),
    ({"GET"}, r"^/asistencia(?:/detalle)?$", "horarios", "view"),
    ({"POST"}, r"^/marcaciones$", "horarios", "create"),
    ({"GET"}, r"^/monitor/rutas$", "horarios", "view"),
    ({"POST"}, r"^/gps/ping$", "horarios", "create"),
    ({"GET"}, r"^/gps/(?:activos|historico|recorrido/.+)$", "horarios", "view"),
    ({"GET"}, r"^/novedades-tipo$", "horarios", "view"),
    ({"POST"}, r"^/novedades-tipo$", "horarios", "edit"),
    ({"GET"}, r"^/stats$", "dashboard", "view"),
    ({"GET"}, r"^/referencias$", "referencias", "view"),
    ({"POST", "PUT"}, r"^/referencias(?:/.*)?$", "referencias", "edit"),
    ({"GET"}, r"^/ordenes$", "servicios", "view"),
    ({"POST"}, r"^/ordenes$", "servicios", "create"),
    ({"PATCH", "POST"}, r"^/ordenes/\d+/(?:iniciar|cerrar|inspeccion|cerrar-no-ejecutada)$", "servicios", "edit"),
    ({"GET"}, r"^/ordenes/\d+/(?:detalle|fotos|reporte-completo)$", "servicios", "view"),
    ({"POST"}, r"^/ordenes/\d+/fotos$", "servicios", "edit"),
    ({"GET"}, r"^/ordenes/\d+/reporte-pdf$", "servicios", "export"),
    ({"POST"}, r"^/novedades_servicio$", "servicios", "edit"),
    ({"GET"}, r"^/reportes/horas-extra$", "reportes", "view"),
]


def empty_permissions():
    result = {}
    for module_key, actions in PERMISSION_CATALOG.items():
        result[module_key] = {action: False for action in actions}
    return result


def full_permissions():
    result = empty_permissions()
    for module_key in result:
        for action in result[module_key]:
            result[module_key][action] = True
    return result


def normalize_permissions(raw_permissions):
    base = empty_permissions()
    if raw_permissions == "FULL":
        return full_permissions()
    if not isinstance(raw_permissions, dict):
        return base
    for module_key, actions in base.items():
        module_value = raw_permissions.get(module_key)
        if not isinstance(module_value, dict):
            continue
        for action in actions:
            base[module_key][action] = bool(module_value.get(action))
    return base


def permissions_to_json(raw_permissions):
    return json.dumps(normalize_permissions(raw_permissions), ensure_ascii=True)


def parse_permissions(raw_value):
    if not raw_value:
        return empty_permissions()
    if isinstance(raw_value, dict):
        return normalize_permissions(raw_value)
    try:
        return normalize_permissions(json.loads(raw_value))
    except Exception:
        return empty_permissions()


def role_code_from_name(name: str):
    sanitized = re.sub(r"[^a-z0-9]+", "_", (name or "").strip().lower()).strip("_")
    return sanitized or "rol"


def ensure_roles_schema(cur, conn):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS roles (
            id SERIAL PRIMARY KEY,
            codigo TEXT UNIQUE NOT NULL,
            nombre TEXT UNIQUE NOT NULL,
            descripcion TEXT DEFAULT '',
            permisos_json TEXT NOT NULL,
            activo BOOLEAN DEFAULT TRUE,
            es_sistema BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role_id INTEGER")
    conn.commit()

    for role_template in SYSTEM_ROLE_TEMPLATES:
        cur.execute("""
            INSERT INTO roles (codigo, nombre, descripcion, permisos_json, activo, es_sistema)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (codigo) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                descripcion = EXCLUDED.descripcion,
                permisos_json = EXCLUDED.permisos_json,
                activo = EXCLUDED.activo,
                es_sistema = EXCLUDED.es_sistema
        """, (
            role_template["codigo"],
            role_template["nombre"],
            role_template["descripcion"],
            permissions_to_json(role_template["permisos"]),
            role_template["activo"],
            role_template["es_sistema"],
        ))
    conn.commit()

    cur.execute("""
        UPDATE usuarios u
        SET role_id = r.id
        FROM roles r
        WHERE u.role_id IS NULL
          AND LOWER(COALESCE(u.rol, '')) = r.codigo
    """)
    conn.commit()


def fetch_role_by_id(cur, role_id: int):
    cur.execute("""
        SELECT id, codigo, nombre, descripcion, permisos_json, activo, es_sistema
        FROM roles
        WHERE id = %s
    """, (role_id,))
    row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "codigo": row[1],
        "nombre": row[2],
        "descripcion": row[3] or "",
        "permissions": parse_permissions(row[4]),
        "activo": bool(row[5]),
        "es_sistema": bool(row[6]),
    }


def get_fallback_permissions(role_code: str):
    normalized = (role_code or "").strip().lower()
    for role_template in SYSTEM_ROLE_TEMPLATES:
        if role_template["codigo"] == normalized:
            return normalize_permissions(role_template["permisos"])
    return empty_permissions()


def get_user_context(user_id):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_roles_schema(cur, conn)
        cur.execute("""
            SELECT u.id,
                   COALESCE(u.nombre, u.username),
                   COALESCE(u.rol, ''),
                   COALESCE(u.username, ''),
                   COALESCE(u.activo, TRUE),
                   u.role_id,
                   r.codigo,
                   r.nombre,
                   r.descripcion,
                   r.permisos_json,
                   r.activo
            FROM usuarios u
            LEFT JOIN roles r ON r.id = u.role_id
            WHERE u.id = %s
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            return None
        permissions = parse_permissions(row[9]) if row[9] else get_fallback_permissions(row[2])
        return {
            "id": row[0],
            "nombre": row[1],
            "rol": row[6] or row[2] or "",
            "username": row[3],
            "activo": bool(row[4]),
            "role_id": row[5],
            "role_nombre": row[7] or row[2] or "",
            "role_descripcion": row[8] or "",
            "role_activo": bool(row[10]) if row[10] is not None else True,
            "permissions": permissions,
        }
    finally:
        release_conn(conn)


def find_permission_rule(method: str, path: str):
    for methods, pattern, module_key, action in PERMISSION_RULES:
        if method in methods and re.match(pattern, path):
            return module_key, action
    return None


@app.middleware("http")
async def authorization_middleware(request: Request, call_next):
    path = request.url.path
    method = request.method.upper()

    if method == "OPTIONS" or path in {"/", "/health", "/login"}:
        return await call_next(request)

    matched_rule = find_permission_rule(method, path)
    if not matched_rule:
        return await call_next(request)

    raw_user_id = request.headers.get("X-User-Id", "").strip()
    if not raw_user_id:
        return JSONResponse(status_code=401, content={"detail": "Sesion no autenticada"})

    try:
        user_id = int(raw_user_id)
    except ValueError:
        return JSONResponse(status_code=401, content={"detail": "Usuario activo invalido"})

    user_ctx = get_user_context(user_id)
    if not user_ctx or not user_ctx.get("activo"):
        return JSONResponse(status_code=403, content={"detail": "Usuario inactivo o inexistente"})

    module_key, action = matched_rule
    if not user_ctx.get("permissions", {}).get(module_key, {}).get(action, False):
        return JSONResponse(
            status_code=403,
            content={"detail": f"Sin permiso para {action} en {module_key}"}
        )

    request.state.current_user = user_ctx
    return await call_next(request)

# ============================================================
# MODELOS PYDANTIC (validacion de datos)
# ============================================================
class LoginRequest(BaseModel):
    username: str
    password: str

class PersonalCreate(BaseModel):
    nombre: str
    doc: Optional[str] = ""
    user: str
    pas: Optional[str] = "1234"
    rol: str
    role_id: Optional[int] = None
    id_interno: str
    empresa: Optional[str] = "APEX"
    costo: Optional[float] = 0
    salario: Optional[float] = 0
    extra: Optional[float] = 0


class RoleCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    permissions: dict = {}
    activo: bool = True


class FotoUpload(BaseModel):
    orden_id: int
    tipo: str
    base64_data: str
    size_original: int
    metadata: dict = {}

class VehiculoCreate(BaseModel):
    placa: str
    modelo: Optional[str] = ""
    tipo: Optional[str] = ""
    marca: Optional[str] = ""
    anio: Optional[int] = None
    color: Optional[str] = ""
    cilindraje: Optional[str] = ""
    capacidad_carga: Optional[str] = ""
    combustible: Optional[str] = ""
    kilometraje: Optional[int] = 0
    num_serie: Optional[str] = ""
    num_motor: Optional[str] = ""
    soat_vence: Optional[str] = ""
    tecnomecanica_vence: Optional[str] = ""
    seguro_vence: Optional[str] = ""
    propietario: Optional[str] = ""
    estado: Optional[str] = "activo"
    observaciones: Optional[str] = ""

class AsistenciaCreate(BaseModel):
    usuario: str
    vehiculo_placa: str
    tipo_marca: str

# ============================================================
# HEALTH CHECK
# ============================================================
@app.get("/")
def root():
    return {"status": "APEX API v2.0 corriendo", "timestamp": str(datetime.now())}

@app.get("/health")
def health():
    try:
        conn = get_conn()
        release_conn(conn)
        return {"status": "ok", "db": "conectada"}
    except Exception as e:
        return {"status": "error", "db": str(e)}

# ============================================================
# AUTH - LOGIN
# ============================================================
@app.post("/login")
def login(req: LoginRequest):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_roles_schema(cur, conn)
        cur.execute(
            """SELECT u.id,
                      COALESCE(u.nombre, u.username) as nombre,
                      COALESCE(r.codigo, u.rol, '') as rol_codigo,
                      COALESCE(u.username, '') as username,
                      u.role_id,
                      COALESCE(r.nombre, u.rol, '') as role_nombre,
                      COALESCE(r.descripcion, '') as role_descripcion,
                      r.permisos_json,
                      COALESCE(u.activo, TRUE) as usuario_activo,
                      COALESCE(r.activo, TRUE) as rol_activo
               FROM usuarios
               u
               LEFT JOIN roles r ON r.id = u.role_id
               WHERE u.username = %s AND u.password = %s""",
            (req.username, req.password)
        )
        row = cur.fetchone()
        if row:
            if not row[8]:
                raise HTTPException(status_code=403, detail="Usuario inactivo")
            if not row[9]:
                raise HTTPException(status_code=403, detail="El rol asignado esta inactivo")
            permissions = parse_permissions(row[7]) if row[7] else get_fallback_permissions(row[2])
            return {
                "usuario": {
                    "id": row[0],
                    "nombre": row[1],
                    "rol": row[2],
                    "username": row[3],
                    "role_id": row[4],
                    "role_nombre": row[5],
                    "role_descripcion": row[6],
                    "permissions": permissions,
                }
            }
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


@app.get("/roles")
def get_roles(activo: Optional[bool] = None):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_roles_schema(cur, conn)
        query = """
            SELECT id, codigo, nombre, descripcion, permisos_json, activo, es_sistema
            FROM roles
        """
        params = []
        if activo is not None:
            query += " WHERE activo = %s"
            params.append(activo)
        query += " ORDER BY es_sistema DESC, nombre"
        cur.execute(query, params)
        rows = cur.fetchall()
        return [
            {
                "id": row[0],
                "codigo": row[1],
                "nombre": row[2],
                "descripcion": row[3] or "",
                "permissions": parse_permissions(row[4]),
                "activo": bool(row[5]),
                "es_sistema": bool(row[6]),
            }
            for row in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


@app.post("/roles")
def crear_rol(role: RoleCreate):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_roles_schema(cur, conn)
        codigo = role_code_from_name(role.nombre)
        cur.execute("SELECT 1 FROM roles WHERE codigo = %s", (codigo,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Ya existe un rol con ese nombre")
        cur.execute("""
            INSERT INTO roles (codigo, nombre, descripcion, permisos_json, activo, es_sistema)
            VALUES (%s, %s, %s, %s, %s, FALSE)
            RETURNING id
        """, (
            codigo,
            role.nombre.strip(),
            (role.descripcion or "").strip(),
            permissions_to_json(role.permissions),
            role.activo,
        ))
        role_id = cur.fetchone()[0]
        conn.commit()
        return {"ok": True, "id": role_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.put("/roles/{role_id}")
def editar_rol(role_id: int, role: RoleCreate):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_roles_schema(cur, conn)
        current = fetch_role_by_id(cur, role_id)
        if not current:
            raise HTTPException(status_code=404, detail="Rol no encontrado")
        codigo = current["codigo"] if current["es_sistema"] else role_code_from_name(role.nombre)
        cur.execute("""
            SELECT 1 FROM roles
            WHERE codigo = %s AND id <> %s
        """, (codigo, role_id))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Ya existe otro rol con ese nombre")
        cur.execute("""
            UPDATE roles
            SET codigo = %s,
                nombre = %s,
                descripcion = %s,
                permisos_json = %s,
                activo = %s
            WHERE id = %s
        """, (
            codigo,
            role.nombre.strip(),
            (role.descripcion or "").strip(),
            permissions_to_json(role.permissions),
            role.activo,
            role_id,
        ))
        conn.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.patch("/roles/{role_id}/estado")
def toggle_rol(role_id: int, activo: bool):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_roles_schema(cur, conn)
        cur.execute("UPDATE roles SET activo = %s WHERE id = %s", (activo, role_id))
        conn.commit()
        return {"ok": True, "activo": activo}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)

# ============================================================
# PERSONAL
# ============================================================
@app.get("/personal")
def get_personal():
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_roles_schema(cur, conn)
        # Ensure columns exist first
        for col_sql in [
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS salario_base NUMERIC DEFAULT 0",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS id_interno TEXT DEFAULT ''",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT ''",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS documento TEXT DEFAULT ''",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tasa_extra NUMERIC DEFAULT 0",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username TEXT",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE",
        ]:
            try: cur.execute(col_sql); conn.commit()
            except: conn.rollback()
        cur.execute("""
            SELECT u.id, u.nombre, COALESCE(r.codigo, u.rol, ''),
                   COALESCE(salario_base, 0),
                   COALESCE(id_interno, ''),
                   COALESCE(empresa, ''),
                   COALESCE(documento, ''),
                   COALESCE(tasa_extra, 0),
                   COALESCE(username, ''),
                   COALESCE(u.activo, TRUE),
                   u.role_id,
                   COALESCE(r.nombre, ''),
                   COALESCE(costo_servicio, 0)
            FROM usuarios u
            LEFT JOIN roles r ON r.id = u.role_id
            ORDER BY u.nombre
        """)
        rows = cur.fetchall()
        release_conn(conn)
        return [
            {
                "id": r[0], "nombre": r[1], "rol": r[2],
                "salario_base": float(r[3]) if r[3] else 0,
                "id_interno": r[4], "empresa": r[5],
                "documento": r[6], "tasa_extra": float(r[7]) if r[7] else 0,
                "username": r[8], "activo": bool(r[9]),
                "role_id": r[10], "role_nombre": r[11],
                "costo_servicio": float(r[12]) if r[12] else 0,
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/personal")
def crear_personal(p: PersonalCreate):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_roles_schema(cur, conn)
        role_id = p.role_id
        role_code = p.rol
        if role_id:
            role_info = fetch_role_by_id(cur, role_id)
            if not role_info:
                raise HTTPException(status_code=404, detail="Rol no encontrado")
            if not role_info["activo"]:
                raise HTTPException(status_code=400, detail="El rol seleccionado esta inactivo")
            role_code = role_info["codigo"]
        else:
            cur.execute("SELECT id, codigo, activo FROM roles WHERE codigo = %s", ((p.rol or "").strip().lower(),))
            role_row = cur.fetchone()
            if role_row:
                role_id = role_row[0]
                role_code = role_row[1]
                if not role_row[2]:
                    raise HTTPException(status_code=400, detail="El rol seleccionado esta inactivo")
        cur.execute("""
            INSERT INTO usuarios
            (nombre, username, password, rol, role_id, documento, empresa, id_interno, costo_servicio, salario_base, tasa_extra)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (p.nombre, p.user, p.pas, role_code, role_id, p.doc, p.empresa, p.id_interno, p.costo, p.salario, p.extra))
        conn.commit()
        return {"ok": True, "id_interno": p.id_interno}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)

# ============================================================
# VEHICULOS
# ============================================================
@app.get("/vehiculos")
def get_vehiculos():
    try:
        conn = get_conn()
        cur = conn.cursor()
        for col_sql in [
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS marca TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS anio INTEGER",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS color TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS cilindraje TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS capacidad_carga TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS combustible TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS kilometraje INTEGER DEFAULT 0",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS num_serie TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS num_motor TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS soat_vence TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tecnomecanica_vence TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS seguro_vence TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS propietario TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT ''",
        ]:
            try: cur.execute(col_sql); conn.commit()
            except: conn.rollback()
        cur.execute("""
            SELECT id, placa, modelo, estado,
                   COALESCE(tipo,''), COALESCE(marca,''), COALESCE(anio,0),
                   COALESCE(color,''), COALESCE(cilindraje,''),
                   COALESCE(capacidad_carga,''), COALESCE(combustible,''),
                   COALESCE(kilometraje,0), COALESCE(num_serie,''),
                   COALESCE(num_motor,''), COALESCE(soat_vence,''),
                   COALESCE(tecnomecanica_vence,''), COALESCE(seguro_vence,''),
                   COALESCE(propietario,''), COALESCE(observaciones,'')
            FROM vehiculos ORDER BY placa
        """)
        rows = cur.fetchall()
        release_conn(conn)
        return [{
            "id": r[0], "placa": r[1], "modelo": r[2], "estado": r[3],
            "tipo": r[4], "marca": r[5], "anio": r[6],
            "color": r[7], "cilindraje": r[8], "capacidad_carga": r[9],
            "combustible": r[10], "kilometraje": r[11], "num_serie": r[12],
            "num_motor": r[13], "soat_vence": r[14],
            "tecnomecanica_vence": r[15], "seguro_vence": r[16],
            "propietario": r[17], "observaciones": r[18]
        } for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vehiculos")
def crear_vehiculo(v: VehiculoCreate):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO vehiculos (
                placa, modelo, estado, tipo, marca, anio, color,
                cilindraje, capacidad_carga, combustible, kilometraje,
                num_serie, num_motor, soat_vence, tecnomecanica_vence,
                seguro_vence, propietario, observaciones
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            v.placa.upper(), v.modelo, v.estado or "activo",
            v.tipo, v.marca, v.anio, v.color,
            v.cilindraje, v.capacidad_carga, v.combustible, v.kilometraje or 0,
            v.num_serie, v.num_motor, v.soat_vence, v.tecnomecanica_vence,
            v.seguro_vence, v.propietario, v.observaciones
        ))
        conn.commit()
        release_conn(conn)
        return {"ok": True, "placa": v.placa.upper()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/vehiculos/{placa}")
def actualizar_estado_vehiculo(placa: str, estado: str):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("UPDATE vehiculos SET estado = %s WHERE placa = %s", (estado, placa.upper()))
        conn.commit()
        release_conn(conn)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# HORARIOS - PLANEACION
# ============================================================
@app.get("/rutas")
def get_rutas(fecha: Optional[str] = None):
    try:
        conn = get_conn()
        cur = conn.cursor()
        f = fecha if fecha else datetime.now().strftime("%Y-%m-%d")
        cur.execute("""
            SELECT id, vehiculo_placa, empleados_json, hora_inicio_prog,
                   hora_fin_prog, fecha, viaticos, tolerancia_minutos
            FROM planeacion_rutas WHERE fecha = %s ORDER BY id DESC
        """, (f,))
        rows = cur.fetchall()
        release_conn(conn)
        result = []
        for r in rows:
            try:
                empleados = json.loads(r[2]) if r[2] else []
                result.append({
                    "id":       r[0],
                    "placa":    r[1],
                    "equipo":   empleados,
                    "h_inicio": r[3],
                    "h_fin":    r[4],
                    "fecha":    str(r[5]),
                    "viaticos": float(r[6]) if r[6] else 0,
                    "tolerancia_minutos": int(r[7]) if r[7] else 15,
                })
            except:
                continue
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# /rutas POST movido a version extendida abajo

# ============================================================
# ASISTENCIA
# ============================================================
@app.get("/asistencia")
def get_asistencia(fecha: Optional[str] = None, usuario: Optional[str] = None, hoy: Optional[str] = None):
    try:
        conn = get_conn()
        cur = conn.cursor()
        f = fecha or datetime.now().strftime("%Y-%m-%d")
        if hoy == "1":
            f = datetime.now().strftime("%Y-%m-%d")
        query = "SELECT usuario, vehiculo_placa, tipo_marca, hora, fecha FROM asistencia WHERE fecha::text = %s"
        params = [f]
        if usuario:
            query += " AND usuario = %s"
            params.append(usuario)
        query += " ORDER BY id ASC"
        cur.execute(query, params)
        rows = cur.fetchall()
        release_conn(conn)
        return [{
            "usuario": r[0], "placa": r[1],
            "tipo": r[2], "tipo_marca": r[2],   # ambos campos para compatibilidad
            "hora": r[3], "fecha": str(r[4])
        } for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# /asistencia POST movido a /marcaciones con GPS y hora extra

# ============================================================
# REPORTES - STATS GENERALES
# ============================================================
@app.get("/stats")
def get_stats():
    try:
        conn = get_conn()
        cur = conn.cursor()
        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        mes_actual = datetime.now().strftime("%Y-%m")

        cur.execute("SELECT COUNT(*) FROM ordenes_servicio WHERE fecha_creacion::date = %s::date", (fecha_hoy,))
        servicios_hoy = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM usuarios WHERE rol != \'admin\'")
        total_personal = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM vehiculos WHERE estado = \'en ruta\'")
        vehiculos_ruta = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM novedades_servicio ns
            JOIN ordenes_servicio os ON ns.orden_id = os.id
            WHERE os.fecha_creacion::date = %s::date
        """, (fecha_hoy,))
        novedades_hoy = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM vehiculos WHERE estado = 'activo'")
        vehiculos_activos = cur.fetchone()[0]

        release_conn(conn)
        return {
            "ordenes_hoy":        servicios_hoy,
            "personal_activo":    total_personal,
            "vehiculos_activos":  vehiculos_activos,
            "novedades":          novedades_hoy,
            # legacy keys
            "servicios_hoy":      servicios_hoy,
            "vehiculos_en_ruta":  vehiculos_ruta,
        }
    except Exception as e:
        return {"ordenes_hoy": 0, "personal_activo": 0, "vehiculos_activos": 0, "novedades": 0}


# ============================================================
# CONTROL DE HORARIOS - Endpoints adicionales para main_api.py
# Agregar estos endpoints al archivo main_api.py existente
# ============================================================

# Agregar estos imports al inicio del main_api.py (si no los tiene):
# from typing import Optional, List
# import base64

# ============================================================
# STARTUP - Crear tablas si no existen
# ============================================================
@app.on_event("startup")
async def crear_tablas():
    try:
        conn = get_conn()
        cur = conn.cursor()

        # Tablas base
        cur.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                rol TEXT DEFAULT 'empleado',
                username TEXT UNIQUE,
                password TEXT,
                empresa TEXT DEFAULT '',
                salario_base NUMERIC DEFAULT 0,
                tasa_extra NUMERIC DEFAULT 0,
                id_interno TEXT DEFAULT '',
                documento TEXT DEFAULT '',
                activo BOOLEAN DEFAULT TRUE
            )
        """); conn.commit()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS vehiculos (
                id SERIAL PRIMARY KEY,
                placa TEXT UNIQUE NOT NULL,
                modelo TEXT DEFAULT '',
                estado TEXT DEFAULT 'activo'
            )
        """); conn.commit()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS asistencia (
                id SERIAL PRIMARY KEY,
                usuario TEXT,
                tipo_marca TEXT,
                hora TEXT,
                fecha DATE DEFAULT CURRENT_DATE,
                vehiculo_placa TEXT DEFAULT '',
                latitud NUMERIC,
                longitud NUMERIC,
                es_extra BOOLEAN DEFAULT FALSE,
                minutos_extra INTEGER DEFAULT 0,
                ruta_id INTEGER
            )
        """); conn.commit()

        # Tabla maestro de tipos de novedad
        # Columnas adicionales vehiculos
        for col in [
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS marca TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS anio INTEGER",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS color TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS cilindraje TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS capacidad_carga TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS combustible TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS kilometraje INTEGER DEFAULT 0",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS num_serie TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS num_motor TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS soat_vence TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tecnomecanica_vence TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS seguro_vence TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS propietario TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT ''",
        ]:
            try: cur.execute(col); conn.commit()
            except: pass

        for col in [
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS marca TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS anio INTEGER",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS color TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS cilindraje TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS capacidad_carga TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS combustible TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS kilometraje INTEGER DEFAULT 0",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS num_serie TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS num_motor TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS soat_vence TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tecnomecanica_vence TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS seguro_vence TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS propietario TEXT DEFAULT ''",
            "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT ''",
        ]:
            try: cur.execute(col); conn.commit()
            except: pass

        cur.execute("""
            CREATE TABLE IF NOT EXISTS maestro_novedades_tipo (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                descripcion TEXT,
                requiere_foto BOOLEAN DEFAULT FALSE,
                requiere_gps BOOLEAN DEFAULT TRUE,
                requiere_texto BOOLEAN DEFAULT TRUE,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # Insertar novedades por defecto si la tabla esta vacia
        cur.execute("SELECT COUNT(*) FROM maestro_novedades_tipo")
        if cur.fetchone()[0] == 0:
            novedades_default = [
                ("Trafico pesado",        "Congestion vehicular en la via",           True, True, True),
                ("Retraso en cliente",    "Cliente no estaba disponible a tiempo",    False, True, True),
                ("Accidente de transito", "Accidente en la via que impide el paso",   True, True, True),
                ("Falla mecanica",        "Problema mecanico con el vehiculo",        True, True, True),
                ("Condiciones climaticas","Lluvia, neblina u otras condiciones",      True, True, True),
                ("Cierre de via",         "Via bloqueada por autoridades o eventos",  True, True, True),
                ("Otro",                  "Motivo no listado, describir en detalle",  False, True, True),
            ]
            for nov in novedades_default:
                cur.execute("""
                    INSERT INTO maestro_novedades_tipo (nombre, descripcion, requiere_foto, requiere_gps, requiere_texto)
                    VALUES (%s, %s, %s, %s, %s)
                """, nov)

        # Agregar tasa_extra a usuarios si no existe
        cur.execute("""
            ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS tasa_extra DECIMAL(12,2) DEFAULT 0
        """)

        # Extender tabla asistencia con campos nuevos
        cur.execute("""
            ALTER TABLE asistencia
            ADD COLUMN IF NOT EXISTS latitud DECIMAL(10,8),
            ADD COLUMN IF NOT EXISTS longitud DECIMAL(11,8),
            ADD COLUMN IF NOT EXISTS novedad_tipo_id INTEGER REFERENCES maestro_novedades_tipo(id),
            ADD COLUMN IF NOT EXISTS novedad_descripcion TEXT,
            ADD COLUMN IF NOT EXISTS es_extra BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS minutos_extra INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS ruta_id INTEGER
        """)

        # Extender tabla planeacion_rutas con campos nuevos
        cur.execute("""
            ALTER TABLE planeacion_rutas
            ADD COLUMN IF NOT EXISTS viaticos DECIMAL(12,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'programada',
            ADD COLUMN IF NOT EXISTS hora_inicio_real VARCHAR(10),
            ADD COLUMN IF NOT EXISTS hora_fin_real VARCHAR(10),
            ADD COLUMN IF NOT EXISTS tolerancia_minutos INTEGER DEFAULT 15
        """)

        # Tabla registro horas extra
        # Columnas adicionales en usuarios
        for col_sql in [
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS documento TEXT",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tasa_extra NUMERIC DEFAULT 0",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE",
        ]:
            try: cur.execute(col_sql); conn.commit()
            except: pass

        # Columnas adicionales en usuarios
        for col_sql in [
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS documento TEXT",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tasa_extra NUMERIC DEFAULT 0",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE",
        ]:
            try:
                cur.execute(col_sql)
                conn.commit()
            except:
                pass

        cur.execute("""
            CREATE TABLE IF NOT EXISTS horas_extra_registro (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id),
                ruta_id INTEGER REFERENCES planeacion_rutas(id),
                fecha DATE NOT NULL,
                minutos_extra_diurnos INTEGER DEFAULT 0,
                minutos_extra_nocturnos INTEGER DEFAULT 0,
                valor_hora_extra DECIMAL(12,2) DEFAULT 0,
                valor_diurno DECIMAL(12,2) DEFAULT 0,
                valor_nocturno DECIMAL(12,2) DEFAULT 0,
                total_a_pagar DECIMAL(12,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        conn.commit()
        release_conn(conn)
        print("Tablas de horarios creadas/verificadas OK")
    except Exception as e:
        print(f"Error creando tablas: {e}")


# ============================================================
# MODELOS PYDANTIC - Horarios
# ============================================================
class MarcacionCreate(BaseModel):
    usuario: str
    vehiculo_placa: Optional[str] = ""
    tipo_marca: str
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    ruta_id: Optional[str] = None
    novedad_tipo_id: Optional[str] = None
    novedad_descripcion: Optional[str] = ""

    def get_ruta_id(self):
        try:
            v = str(self.ruta_id or "").strip()
            return int(v) if v else None
        except Exception:
            return None

    def get_novedad_id(self):
        try:
            v = str(self.novedad_tipo_id or "").strip()
            return int(v) if v else None
        except Exception:
            return None

class RutaCreate(BaseModel):
    fecha: str
    placa: str
    empleados: list
    h_inicio: str
    h_fin: str
    viaticos: Optional[float] = 0
    tolerancia_minutos: Optional[int] = 15

class NovedadTipoCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    requiere_foto: Optional[bool] = False
    requiere_gps: Optional[bool] = True
    requiere_texto: Optional[bool] = True


# ============================================================
# ENDPOINTS - MAESTRO NOVEDADES
# ============================================================
@app.get("/novedades-tipo")
def get_novedades_tipo():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, nombre, descripcion, requiere_foto, requiere_gps, requiere_texto
            FROM maestro_novedades_tipo WHERE activo = TRUE ORDER BY nombre
        """)
        rows = cur.fetchall()
        release_conn(conn)
        return [
            {"id": r[0], "nombre": r[1], "descripcion": r[2],
             "requiere_foto": r[3], "requiere_gps": r[4], "requiere_texto": r[5]}
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/novedades-tipo")
def crear_novedad_tipo(n: NovedadTipoCreate):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO maestro_novedades_tipo (nombre, descripcion, requiere_foto, requiere_gps, requiere_texto)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        """, (n.nombre, n.descripcion, n.requiere_foto, n.requiere_gps, n.requiere_texto))
        nid = cur.fetchone()[0]
        conn.commit()
        release_conn(conn)
        return {"ok": True, "id": nid}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# ENDPOINTS - MARCACIONES CON GPS Y DETECCION HORA EXTRA
# ============================================================
@app.post("/marcaciones")
def crear_marcacion(m: MarcacionCreate):
    try:
        hora_actual = datetime.now().strftime("%H:%M")
        fecha_actual = datetime.now().strftime("%Y-%m-%d")
        hora_num = int(hora_actual.replace(":", ""))
        es_extra = False
        minutos_extra = 0
        valor_extra_diurno = 0
        valor_extra_nocturno = 0

        conn = get_conn()
        cur = conn.cursor()

        # Verificar si hay hora extra en CIERRE
        if m.tipo_marca == "CIERRE" and m.ruta_id:
            cur.execute("""
                SELECT hora_fin_prog, hora_inicio_prog, tolerancia_minutos
                FROM planeacion_rutas WHERE id = %s
            """, (m.ruta_id,))
            ruta = cur.fetchone()

            if ruta:
                h_fin_prog, h_inicio_prog, tolerancia = ruta
                # Convertir hora fin programada a minutos
                try:
                    h_fin_parts = h_fin_prog.replace(" AM","").replace(" PM","").split(":")
                    h_fin_min = int(h_fin_parts[0]) * 60 + int(h_fin_parts[1])
                    # Si PM sumar 12 horas
                    if "PM" in h_fin_prog and int(h_fin_parts[0]) != 12:
                        h_fin_min += 720

                    h_inicio_parts = h_inicio_prog.replace(" AM","").replace(" PM","").split(":")
                    h_inicio_min = int(h_inicio_parts[0]) * 60 + int(h_inicio_parts[1])
                    if "PM" in h_inicio_prog and int(h_inicio_parts[0]) != 12:
                        h_inicio_min += 720

                    # Hora actual en minutos
                    ahora = datetime.now()
                    hora_ahora_min = ahora.hour * 60 + ahora.minute

                    # Jornada programada en minutos
                    jornada_prog = h_fin_min - h_inicio_min
                    jornada_real = hora_ahora_min - h_inicio_min

                    # Extra si supera hora fin + tolerancia O supera 8 horas
                    extra_por_ruta = hora_ahora_min - (h_fin_min + tolerancia)
                    extra_por_jornada = jornada_real - 480  # 8 horas = 480 min

                    minutos_extra = max(0, max(extra_por_ruta, extra_por_jornada))
                    es_extra = minutos_extra > 0

                    if es_extra:
                        # Clasificar diurna (06-21) vs nocturna (21-06)
                        hora_cierre = ahora.hour
                        if 6 <= hora_cierre < 21:
                            minutos_extra_diurnos = minutos_extra
                            minutos_extra_nocturnos = 0
                        else:
                            minutos_extra_diurnos = 0
                            minutos_extra_nocturnos = minutos_extra

                        # Obtener valor hora extra del usuario
                        cur.execute("""
                            SELECT tasa_extra FROM usuarios WHERE nombre = %s
                        """, (m.usuario,))
                        usr = cur.fetchone()
                        tasa = float(usr[0]) if usr and usr[0] else 0

                        valor_extra_diurno = round((minutos_extra_diurnos / 60) * tasa, 2)
                        valor_extra_nocturno = round((minutos_extra_nocturnos / 60) * tasa * 1.35, 2)

                        # Obtener id usuario
                        cur.execute("SELECT id FROM usuarios WHERE nombre = %s", (m.usuario,))
                        usr_row = cur.fetchone()
                        usr_id = usr_row[0] if usr_row else None

                        if usr_id:
                            cur.execute("""
                                INSERT INTO horas_extra_registro
                                (usuario_id, ruta_id, fecha, minutos_extra_diurnos, minutos_extra_nocturnos,
                                 valor_hora_extra, valor_diurno, valor_nocturno, total_a_pagar)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (
                                usr_id, m.ruta_id, fecha_actual,
                                minutos_extra_diurnos if es_extra else 0,
                                minutos_extra_nocturnos if es_extra else 0,
                                tasa, valor_extra_diurno, valor_extra_nocturno,
                                valor_extra_diurno + valor_extra_nocturno
                            ))
                except Exception as ex:
                    print(f"Error calculando hora extra: {ex}")

        # Insertar marcacion
        cur.execute("""
            INSERT INTO asistencia
            (usuario, vehiculo_placa, tipo_marca, hora, fecha, latitud, longitud,
             novedad_tipo_id, novedad_descripcion, es_extra, minutos_extra, ruta_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            m.usuario, m.vehiculo_placa, m.tipo_marca, hora_actual, fecha_actual,
            m.latitud, m.longitud, m.novedad_tipo_id, m.novedad_descripcion,
            es_extra, minutos_extra, m.ruta_id
        ))
        marca_id = cur.fetchone()[0]
        conn.commit()
        release_conn(conn)

        return {
            "ok": True,
            "hora": hora_actual,
            "es_extra": es_extra,
            "minutos_extra": minutos_extra,
            "valor_extra_diurno": valor_extra_diurno,
            "valor_extra_nocturno": valor_extra_nocturno,
            "alerta": es_extra
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# ENDPOINTS - RUTAS (extendido con viaticos y estado)
# ============================================================
@app.post("/rutas")
def crear_ruta_v2(p: RutaCreate):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO planeacion_rutas
            (fecha, vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog, viaticos, tolerancia_minutos)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (p.fecha, p.placa, json.dumps(p.empleados), p.h_inicio, p.h_fin, p.viaticos, p.tolerancia_minutos))
        ruta_id = cur.fetchone()[0]
        conn.commit()
        release_conn(conn)
        return {"ok": True, "ruta_id": ruta_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# ENDPOINTS - MONITOR EN VIVO
# ============================================================
@app.get("/monitor/rutas")
def monitor_rutas(fecha: Optional[str] = None):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        f = fecha or datetime.now().strftime("%Y-%m-%d")

        # QUERY 1: todas las rutas del dia (1 roundtrip)
        cur.execute("""
            SELECT id, vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog,
                   viaticos, estado, hora_inicio_real, hora_fin_real, tolerancia_minutos
            FROM planeacion_rutas WHERE fecha::text = %s ORDER BY hora_inicio_prog
        """, (f,))
        rutas = cur.fetchall()
        if not rutas:
            return []

        # Recopilar todos los empleados y placas de todas las rutas
        todos_empleados = set()
        todas_placas    = set()
        todas_ruta_ids  = set()
        rutas_data = []
        for r in rutas:
            try:
                empleados = json.loads(r[2]) if r[2] else []
            except Exception:
                empleados = []
            rutas_data.append((r, empleados))
            for emp in empleados:
                todos_empleados.add(emp.strip())
            todas_placas.add(r[1])
            todas_ruta_ids.add(r[0])

        # QUERY 2: resolver nombre/username de todos los empleados a la vez (1 roundtrip)
        emp_list = list(todos_empleados)
        nombre_map = {}  # emp -> (nombre_real, username)
        if emp_list:
            cur.execute("""
                SELECT COALESCE(nombre, username), COALESCE(username, nombre)
                FROM usuarios
                WHERE nombre = ANY(%s) OR username = ANY(%s)
            """, (emp_list, emp_list))
            for row in cur.fetchall():
                nombre_map[row[0]] = (row[0], row[1])
                nombre_map[row[1]] = (row[0], row[1])

        # QUERY 3: TODAS las marcaciones del dia para todos los empleados (1 roundtrip)
        placas_list  = list(todas_placas)
        ruta_ids_list = list(todas_ruta_ids)

        # Expandir candidatos con nombres y usernames resueltos
        candidatos_todos = set()
        for emp in emp_list:
            candidatos_todos.add(emp)
            if emp in nombre_map:
                candidatos_todos.add(nombre_map[emp][0])
                candidatos_todos.add(nombre_map[emp][1])
        candidatos_list = list(candidatos_todos)

        marcaciones_bd = {}  # usuario_lower -> [marcas]
        if candidatos_list:
            cur.execute("""
                SELECT usuario, tipo_marca, hora, latitud, longitud, es_extra, minutos_extra,
                       ruta_id, vehiculo_placa
                FROM asistencia
                WHERE fecha::text = %s
                  AND (usuario = ANY(%s)
                       OR ruta_id = ANY(%s)
                       OR vehiculo_placa = ANY(%s))
                ORDER BY id ASC
            """, (f, candidatos_list, ruta_ids_list, placas_list))
            for row in cur.fetchall():
                key = (row[0] or "").strip().lower()
                if key not in marcaciones_bd:
                    marcaciones_bd[key] = []
                marcaciones_bd[key].append(row)

        ahora_min = datetime.now().hour * 60 + datetime.now().minute
        resultado = []

        for (r, empleados) in rutas_data:
            ruta_id = r[0]
            placa   = r[1]
            marcaciones_empleados = []

            for emp in empleados:
                emp_s = emp.strip()
                # Resolver nombre y username
                pair = nombre_map.get(emp_s, (emp_s, emp_s))
                emp_nombre   = pair[0]
                emp_username = pair[1]
                candidatos_emp = {emp_s.lower(), emp_nombre.lower(), emp_username.lower()}

                # Buscar marcaciones: primero con filtro de ruta/placa, luego fallback
                todas_marcas = []
                for key, marcas in marcaciones_bd.items():
                    if key in candidatos_emp:
                        # Filtrar por ruta o placa
                        con_ruta = [m for m in marcas if m[7] == ruta_id or m[8] == placa]
                        if con_ruta:
                            todas_marcas = con_ruta
                        elif not todas_marcas:
                            todas_marcas = marcas  # fallback sin filtro ruta

                ultima  = todas_marcas[-1] if todas_marcas else None
                primera = todas_marcas[0]  if todas_marcas else None

                tiempo_ruta = None
                if primera:
                    try:
                        hp = primera[2].split(":")
                        h_min = int(hp[0]) * 60 + int(hp[1])
                        tiempo_ruta = ahora_min - h_min
                    except Exception:
                        tiempo_ruta = None

                historial = [{
                    "tipo": m[1], "hora": m[2],
                    "latitud":  float(m[3]) if m[3] else None,
                    "longitud": float(m[4]) if m[4] else None,
                    "es_extra": m[5] or False,
                    "minutos_extra": m[6] or 0
                } for m in todas_marcas]

                marcaciones_empleados.append({
                    "nombre":         emp_nombre,
                    "username":       emp_username,
                    "ultima_marca":   ultima[1] if ultima else "SIN MARCAR",
                    "hora_marca":     ultima[2] if ultima else None,
                    "latitud":  float(ultima[3]) if ultima and ultima[3] else None,
                    "longitud": float(ultima[4]) if ultima and ultima[4] else None,
                    "es_extra":       ultima[5] if ultima else False,
                    "minutos_extra":  ultima[6] if ultima else 0,
                    "tiempo_en_ruta_min": tiempo_ruta,
                    "historial":      historial
                })

            resultado.append({
                "id":    ruta_id,
                "placa": placa,
                "empleados": marcaciones_empleados,
                "h_inicio":  r[3],
                "h_fin":     r[4],
                "viaticos":  float(r[5]) if r[5] else 0,
                "estado":    r[6] or "programada",
                "tolerancia": r[9] or 15,
                "total_empleados":  len(empleados),
                "empleados_activos": sum(
                    1 for e in marcaciones_empleados if e["ultima_marca"] != "SIN MARCAR"
                )
            })

        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


# ============================================================
# ENDPOINTS - REPORTES HORAS EXTRA
# ============================================================
@app.get("/reportes/horas-extra")
def reporte_horas_extra(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    usuario_id: Optional[int] = None,
    ruta_id: Optional[int] = None
):
    try:
        conn = get_conn()
        cur = conn.cursor()

        query = """
            SELECT h.id, u.nombre, u.id_interno, h.fecha,
                   h.minutos_extra_diurnos, h.minutos_extra_nocturnos,
                   h.valor_diurno, h.valor_nocturno, h.total_a_pagar,
                   p.vehiculo_placa
            FROM horas_extra_registro h
            JOIN usuarios u ON h.usuario_id = u.id
            LEFT JOIN planeacion_rutas p ON h.ruta_id = p.id
            WHERE 1=1
        """
        params = []

        if fecha_inicio:
            query += " AND h.fecha >= %s"
            params.append(fecha_inicio)
        if fecha_fin:
            query += " AND h.fecha <= %s"
            params.append(fecha_fin)
        if usuario_id:
            query += " AND h.usuario_id = %s"
            params.append(usuario_id)
        if ruta_id:
            query += " AND h.ruta_id = %s"
            params.append(ruta_id)

        query += " ORDER BY h.fecha DESC, u.nombre"
        cur.execute(query, params)
        rows = cur.fetchall()
        release_conn(conn)

        return [
            {
                "id": r[0], "empleado": r[1], "id_interno": r[2],
                "fecha": str(r[3]),
                "minutos_extra_diurnos": r[4], "minutos_extra_nocturnos": r[5],
                "horas_extra_diurnas": round(r[4]/60, 2) if r[4] else 0,
                "horas_extra_nocturnas": round(r[5]/60, 2) if r[5] else 0,
                "valor_diurno": float(r[6]) if r[6] else 0,
                "valor_nocturno": float(r[7]) if r[7] else 0,
                "total_a_pagar": float(r[8]) if r[8] else 0,
                "vehiculo": r[9]
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINTS - ASISTENCIA POR RUTA Y FECHA
# ============================================================
@app.get("/asistencia/detalle")
def asistencia_detalle(
    fecha: Optional[str] = None,
    usuario: Optional[str] = None,
    placa: Optional[str] = None
):
    try:
        conn = get_conn()
        cur = conn.cursor()
        f = fecha or datetime.now().strftime("%Y-%m-%d")

        query = """
            SELECT a.id, a.usuario, a.vehiculo_placa, a.tipo_marca, a.hora, a.fecha,
                   a.latitud, a.longitud, a.es_extra, a.minutos_extra,
                   n.nombre as novedad_nombre, a.novedad_descripcion
            FROM asistencia a
            LEFT JOIN maestro_novedades_tipo n ON a.novedad_tipo_id = n.id
            WHERE a.fecha::text = %s
        """
        params = [f]

        if usuario:
            query += " AND a.usuario = %s"
            params.append(usuario)
        if placa:
            query += " AND a.vehiculo_placa = %s"
            params.append(placa)

        query += " ORDER BY a.hora"
        cur.execute(query, params)
        rows = cur.fetchall()
        release_conn(conn)

        return [
            {
                "id": r[0], "usuario": r[1], "placa": r[2],
                "tipo_marca": r[3], "hora": r[4], "fecha": str(r[5]),
                "latitud": float(r[6]) if r[6] else None,
                "longitud": float(r[7]) if r[7] else None,
                "es_extra": r[8], "minutos_extra": r[9],
                "novedad": r[10], "novedad_descripcion": r[11]
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.put("/personal/{uid}")
def editar_personal(uid: int, p: PersonalCreate):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_roles_schema(cur, conn)
        role_id = p.role_id
        role_code = p.rol
        if role_id:
            role_info = fetch_role_by_id(cur, role_id)
            if not role_info:
                raise HTTPException(status_code=404, detail="Rol no encontrado")
            role_code = role_info["codigo"]
        cur.execute("""
            UPDATE usuarios SET
                nombre = %s, documento = %s, empresa = %s,
                salario_base = %s, tasa_extra = %s, rol = %s, role_id = %s,
                costo_servicio = %s
            WHERE id = %s
        """, (p.nombre, p.doc, p.empresa,
              float(p.salario or 0), float(p.extra or 0), role_code, role_id,
              float(p.costo or 0), uid))
        conn.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)

@app.patch("/personal/{uid}/estado")
def toggle_personal(uid: int, activo: bool):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE
        """)
        cur.execute("UPDATE usuarios SET activo = %s WHERE id = %s", (activo, uid))
        conn.commit()
        release_conn(conn)
        return {"ok": True, "activo": activo}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/personal/{uid}/rol")
def asignar_rol_personal(uid: int, role_id: int):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_roles_schema(cur, conn)
        role_info = fetch_role_by_id(cur, role_id)
        if not role_info:
            raise HTTPException(status_code=404, detail="Rol no encontrado")
        if not role_info["activo"]:
            raise HTTPException(status_code=400, detail="No puedes asignar un rol inactivo")
        cur.execute("""
            UPDATE usuarios
            SET role_id = %s,
                rol = %s
            WHERE id = %s
        """, (role_info["id"], role_info["codigo"], uid))
        conn.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


# ==================== GPS TRACKING ====================
@app.post("/gps/ping")
def gps_ping(data: dict):
    """Recibe posicion GPS de un usuario activo - upsert por username+fecha"""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS gps_tracking (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                nombre TEXT,
                latitud NUMERIC,
                longitud NUMERIC,
                precision_m NUMERIC,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                fecha DATE DEFAULT CURRENT_DATE
            )
        """)
        # Agregar constraint unico si no existe
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'gps_tracking_username_fecha_key'
                ) THEN
                    ALTER TABLE gps_tracking
                    ADD CONSTRAINT gps_tracking_username_fecha_key
                    UNIQUE (username, fecha);
                END IF;
            END$$;
        """)
        # Upsert real: insert o actualizar si ya existe para hoy
        cur.execute("""
            INSERT INTO gps_tracking (username, nombre, latitud, longitud, precision_m, timestamp, fecha)
            VALUES (%s, %s, %s, %s, %s, NOW(), CURRENT_DATE)
            ON CONFLICT (username, fecha) DO UPDATE SET
                latitud    = EXCLUDED.latitud,
                longitud   = EXCLUDED.longitud,
                precision_m = EXCLUDED.precision_m,
                timestamp  = NOW(),
                nombre     = EXCLUDED.nombre
        """, (data.get("username"), data.get("nombre"),
              data.get("lat"), data.get("lng"), data.get("precision")))
        conn.commit()
        release_conn(conn)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/gps/activos")
def gps_activos():
    """Retorna ultima posicion de cada usuario activo hoy"""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS gps_tracking (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                nombre TEXT,
                latitud NUMERIC,
                longitud NUMERIC,
                precision_m NUMERIC,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                fecha DATE DEFAULT CURRENT_DATE
            )
        """)
        cur.execute("""
            SELECT g.username, g.nombre, g.latitud, g.longitud,
                   g.precision_m, g.timestamp,
                   u.rol,
                   COALESCE(
                     (SELECT tipo_marca FROM asistencia
                      WHERE usuario = ANY(ARRAY[g.nombre, g.username, COALESCE(u.nombre, g.username)])
                        AND fecha::text = CURRENT_DATE::text
                      ORDER BY id DESC LIMIT 1), 'SIN MARCAR'
                   ) as ultima_marca,
                   COALESCE(
                     (SELECT hora FROM asistencia
                      WHERE usuario = ANY(ARRAY[g.nombre, g.username, COALESCE(u.nombre, g.username)])
                        AND fecha::text = CURRENT_DATE::text
                      ORDER BY id DESC LIMIT 1), ''
                   ) as ultima_hora
            FROM gps_tracking g
            LEFT JOIN usuarios u ON u.username = g.username
            WHERE g.fecha::text = CURRENT_DATE::text
            ORDER BY g.timestamp DESC
        """)
        rows = cur.fetchall()
        release_conn(conn)
        return [{
            "username": r[0], "nombre": r[1],
            "lat": float(r[2]) if r[2] else None,
            "lng": float(r[3]) if r[3] else None,
            "precision": float(r[4]) if r[4] else None,
            "timestamp": r[5].isoformat() if r[5] else None,
            "rol": r[6], "ultima_marca": r[7], "ultima_hora": r[8]
        } for r in rows if r[2] and r[3]]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/gps/recorrido/{nombre}")
def gps_recorrido(nombre: str, fecha: str = None):
    """Retorna todas las marcaciones con GPS de un operario en un dia"""
    try:
        conn = get_conn()
        cur = conn.cursor()
        fecha_q = fecha or "CURRENT_DATE"
        cur.execute(f"""
            SELECT tipo_marca, hora, latitud, longitud, es_extra, minutos_extra, vehiculo_placa
            FROM asistencia
            WHERE usuario = %s
              AND latitud IS NOT NULL
              AND longitud IS NOT NULL
              AND fecha::text = COALESCE(%s, CURRENT_DATE::text)
            ORDER BY id ASC
        """, (nombre, fecha))
        rows = cur.fetchall()
        release_conn(conn)
        return [{
            "tipo": r[0], "hora": r[1],
            "lat": float(r[2]), "lng": float(r[3]),
            "es_extra": r[4], "minutos_extra": r[5],
            "placa": r[6]
        } for r in rows]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/gps/historico")
def gps_historico(fecha: str = None, nombre: str = None, placa: str = None, ruta_id: str = None):
    """Retorna recorridos historicos filtrados por fecha/operario/placa/ruta"""
    try:
        conn = get_conn()
        cur = conn.cursor()

        conditions = ["latitud IS NOT NULL", "longitud IS NOT NULL"]
        params = []

        if fecha:
            conditions.append("fecha::text = %s")
            params.append(fecha)
        else:
            conditions.append("fecha = CURRENT_DATE")

        if nombre:
            conditions.append("usuario ILIKE %s")
            params.append(f"%{nombre}%")

        if placa:
            conditions.append("vehiculo_placa ILIKE %s")
            params.append(f"%{placa}%")

        if ruta_id:
            conditions.append("ruta_id = %s")
            params.append(ruta_id)

        where = " AND ".join(conditions)
        cur.execute(f"""
            SELECT usuario, tipo_marca, hora, latitud, longitud,
                   es_extra, minutos_extra, vehiculo_placa, fecha, ruta_id
            FROM asistencia
            WHERE {where}
            ORDER BY usuario, id ASC
        """, params)
        rows = cur.fetchall()
        release_conn(conn)

        # Group by usuario
        from collections import defaultdict
        grupos = defaultdict(list)
        for r in rows:
            grupos[r[0]].append({
                "tipo": r[1], "hora": str(r[2]),
                "lat": float(r[3]), "lng": float(r[4]),
                "es_extra": r[5], "minutos_extra": r[6],
                "placa": r[7], "fecha": str(r[8]), "ruta_id": r[9]
            })

        return [{"nombre": k, "marcaciones": v} for k, v in grupos.items()]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== MODELOS SERVICIOS ====================
class PiezaItem(BaseModel):
    nombre: str
    cantidad: int = 1
    unidad: Optional[str] = "und"
    descripcion: Optional[str] = ""

class ReferenciaCreate(BaseModel):
    codigo: str
    nombre: str
    categoria: Optional[str] = ""
    descripcion: Optional[str] = ""
    tiempo_estimado_min: Optional[int] = 60
    marca: Optional[str] = ""
    modelo: Optional[str] = ""
    activo: Optional[bool] = True
    piezas: Optional[list] = []

class OrdenCreate(BaseModel):
    referencia_id: int
    tecnico_id: Optional[int] = None
    tipo_servicio: str  # montaje / desmontaje / ambos
    cliente_nombre: str
    cliente_direccion: str
    cliente_telefono: Optional[str] = ""
    num_factura: Optional[str] = ""
    observaciones: Optional[str] = ""
    fecha_programada: Optional[str] = ""

class InspeccionPieza(BaseModel):
    orden_id: int
    pieza_id: int
    nombre_pieza: str
    estado: str  # ok / averiada / faltante
    novedad_descripcion: Optional[str] = ""
    accion_solicitada: Optional[str] = "ninguna"  # ninguna/cambio/garantia

class NovedadServicio(BaseModel):
    orden_id: int
    descripcion: str
    tipo: str  # averia/faltante/otro
    accion: str  # cambio/garantia/informativo
    foto_url: Optional[str] = ""

# ==================== STARTUP TABLAS SERVICIOS ====================
def crear_tablas_servicios(cur, conn):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS referencias (
            id SERIAL PRIMARY KEY,
            codigo TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            categoria TEXT DEFAULT '',
            descripcion TEXT DEFAULT '',
            tiempo_estimado_min INTEGER DEFAULT 60,
            marca TEXT DEFAULT '',
            modelo TEXT DEFAULT '',
            foto_url TEXT DEFAULT '',
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """); conn.commit()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS referencia_piezas (
            id SERIAL PRIMARY KEY,
            referencia_id INTEGER REFERENCES referencias(id) ON DELETE CASCADE,
            nombre TEXT NOT NULL,
            cantidad INTEGER DEFAULT 1,
            unidad TEXT DEFAULT 'und',
            descripcion TEXT DEFAULT '',
            orden_display INTEGER DEFAULT 0
        )
    """); conn.commit()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ordenes_servicio (
            id SERIAL PRIMARY KEY,
            consecutivo TEXT UNIQUE,
            referencia_id INTEGER REFERENCES referencias(id),
            tecnico_id INTEGER,
            tipo_servicio TEXT DEFAULT 'montaje',
            estado TEXT DEFAULT 'pendiente',
            cliente_nombre TEXT DEFAULT '',
            cliente_direccion TEXT DEFAULT '',
            cliente_telefono TEXT DEFAULT '',
            num_factura TEXT DEFAULT '',
            observaciones TEXT DEFAULT '',
            fecha_programada TEXT DEFAULT '',
            fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
            fecha_inicio TIMESTAMPTZ,
            fecha_cierre TIMESTAMPTZ,
            duracion_min INTEGER,
            lat_inicio NUMERIC,
            lng_inicio NUMERIC,
            foto_fachada_url TEXT DEFAULT '',
            foto_final_url TEXT DEFAULT '',
            firma_cliente_url TEXT DEFAULT '',
            creado_por TEXT DEFAULT ''
        )
    """); conn.commit()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS inspeccion_piezas (
            id SERIAL PRIMARY KEY,
            orden_id INTEGER REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
            pieza_id INTEGER,
            nombre_pieza TEXT,
            estado TEXT DEFAULT 'ok',
            foto_url TEXT DEFAULT '',
            novedad_descripcion TEXT DEFAULT '',
            accion_solicitada TEXT DEFAULT 'ninguna',
            timestamp TIMESTAMPTZ DEFAULT NOW()
        )
    """); conn.commit()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS novedades_servicio (
            id SERIAL PRIMARY KEY,
            orden_id INTEGER REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
            descripcion TEXT,
            tipo TEXT DEFAULT 'otro',
            accion TEXT DEFAULT 'informativo',
            foto_url TEXT DEFAULT '',
            timestamp TIMESTAMPTZ DEFAULT NOW()
        )
    """); conn.commit()

# ==================== ENDPOINTS REFERENCIAS ====================
@app.get("/referencias")
def get_referencias(categoria: str = None, activo: bool = None):
    conn = None
    try:
        conn = get_conn(); cur = conn.cursor()
        crear_tablas_servicios(cur, conn)
        conditions = []
        params = []
        if categoria:
            conditions.append("r.categoria = %s"); params.append(categoria)
        if activo is not None:
            conditions.append("r.activo = %s"); params.append(activo)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        # Un solo JOIN - elimina el N+1
        cur.execute(f"""
            SELECT r.id, r.codigo, r.nombre, r.categoria, r.descripcion,
                   r.tiempo_estimado_min, r.marca, r.modelo, r.foto_url, r.activo,
                   p.id as pieza_id, p.nombre as pieza_nombre, p.cantidad,
                   p.unidad, p.descripcion as pieza_desc, p.orden_display
            FROM referencias r
            LEFT JOIN referencia_piezas p ON p.referencia_id = r.id
            {where}
            ORDER BY r.categoria, r.nombre, p.orden_display, p.id
        """, params)
        rows = cur.fetchall()
        # Agrupar en Python
        refs_map = {}
        for row in rows:
            rid = row[0]
            if rid not in refs_map:
                refs_map[rid] = {
                    "id": row[0], "codigo": row[1], "nombre": row[2],
                    "categoria": row[3], "descripcion": row[4],
                    "tiempo_estimado_min": row[5], "marca": row[6],
                    "modelo": row[7], "foto_url": row[8], "activo": row[9],
                    "piezas": []
                }
            if row[10] is not None:  # pieza_id puede ser NULL si no hay piezas
                refs_map[rid]["piezas"].append({
                    "id": row[10], "nombre": row[11], "cantidad": row[12],
                    "unidad": row[13], "descripcion": row[14], "orden": row[15]
                })
        result = list(refs_map.values())
        for r in result:
            r["total_piezas"] = len(r["piezas"])
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)

@app.post("/referencias")
def crear_referencia(r: ReferenciaCreate):
    try:
        conn = get_conn(); cur = conn.cursor()
        crear_tablas_servicios(cur, conn)
        cur.execute("""
            INSERT INTO referencias (codigo,nombre,categoria,descripcion,tiempo_estimado_min,marca,modelo,activo)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (r.codigo.upper(),r.nombre,r.categoria,r.descripcion,r.tiempo_estimado_min,r.marca,r.modelo,r.activo))
        ref_id = cur.fetchone()[0]
        for i, p in enumerate(r.piezas or []):
            cur.execute("""
                INSERT INTO referencia_piezas (referencia_id,nombre,cantidad,unidad,descripcion,orden_display)
                VALUES (%s,%s,%s,%s,%s,%s)
            """, (ref_id, p.get("nombre",""), p.get("cantidad",1), p.get("unidad","und"), p.get("descripcion",""), i))
        conn.commit(); release_conn(conn)
        return {"ok": True, "id": ref_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/referencias/{rid}")
def editar_referencia(rid: int, r: ReferenciaCreate):
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            UPDATE referencias SET codigo=%s,nombre=%s,categoria=%s,descripcion=%s,
            tiempo_estimado_min=%s,marca=%s,modelo=%s,activo=%s WHERE id=%s
        """, (r.codigo.upper(),r.nombre,r.categoria,r.descripcion,r.tiempo_estimado_min,r.marca,r.modelo,r.activo,rid))
        cur.execute("DELETE FROM referencia_piezas WHERE referencia_id=%s", (rid,))
        for i, p in enumerate(r.piezas or []):
            cur.execute("""
                INSERT INTO referencia_piezas (referencia_id,nombre,cantidad,unidad,descripcion,orden_display)
                VALUES (%s,%s,%s,%s,%s,%s)
            """, (rid, p.get("nombre",""), p.get("cantidad",1), p.get("unidad","und"), p.get("descripcion",""), i))
        conn.commit(); release_conn(conn)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== ENDPOINTS ORDENES ====================
@app.get("/ordenes")
def get_ordenes(estado: str = None, tecnico_id: int = None):
    conn = None
    try:
        conn = get_conn(); cur = conn.cursor()
        conditions = []
        params = []
        if estado:
            conditions.append("o.estado = %s"); params.append(estado)
        if tecnico_id:
            conditions.append("o.tecnico_id = %s"); params.append(tecnico_id)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        cur.execute(f"""
            SELECT o.id, o.consecutivo, o.tipo_servicio, o.estado,
                   o.cliente_nombre, o.cliente_direccion, o.cliente_telefono,
                   o.num_factura, o.fecha_creacion, o.fecha_inicio, o.fecha_cierre,
                   o.duracion_min, o.lat_inicio, o.lng_inicio,
                   o.foto_fachada_url, o.foto_final_url, o.firma_cliente_url,
                   o.observaciones, o.fecha_programada, o.creado_por,
                   r.id, r.codigo, r.nombre, r.categoria, r.tiempo_estimado_min,
                   u.nombre as tecnico_nombre, o.tecnico_id, o.referencia_id
            FROM ordenes_servicio o
            LEFT JOIN referencias r ON r.id = o.referencia_id
            LEFT JOIN usuarios u ON u.id = o.tecnico_id
            {where} ORDER BY o.fecha_creacion DESC
        """, params)
        rows = cur.fetchall()
        return [{
            "id":r[0],"consecutivo":r[1],"tipo_servicio":r[2],"estado":r[3],
            "cliente_nombre":r[4],"cliente_direccion":r[5],"cliente_telefono":r[6],
            "num_factura":r[7],"fecha_creacion":str(r[8]) if r[8] else "",
            "fecha_inicio":str(r[9]) if r[9] else "","fecha_cierre":str(r[10]) if r[10] else "",
            "duracion_min":r[11],"lat_inicio":float(r[12]) if r[12] else None,
            "lng_inicio":float(r[13]) if r[13] else None,
            "foto_fachada_url":r[14],"foto_final_url":r[15],"firma_cliente_url":r[16],
            "observaciones":r[17],"fecha_programada":r[18],"creado_por":r[19],
            "referencia_id":r[20],"referencia_codigo":r[21],"referencia_nombre":r[22],
            "referencia_categoria":r[23],"tiempo_estimado_min":r[24],
            "tecnico_nombre":r[25],"tecnico_id":r[26]
        } for r in rows]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)

@app.post("/ordenes")
def crear_orden(o: OrdenCreate, creado_por: str = "admin"):
    try:
        conn = get_conn(); cur = conn.cursor()
        crear_tablas_servicios(cur, conn)
        cur.execute("SELECT COUNT(*)+1 FROM ordenes_servicio")
        num = cur.fetchone()[0]
        consecutivo = f"OS-{str(num).zfill(4)}"
        cur.execute("""
            INSERT INTO ordenes_servicio (consecutivo,referencia_id,tecnico_id,tipo_servicio,
                cliente_nombre,cliente_direccion,cliente_telefono,num_factura,
                observaciones,fecha_programada,creado_por)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (consecutivo,o.referencia_id,o.tecnico_id,o.tipo_servicio,
              o.cliente_nombre,o.cliente_direccion,o.cliente_telefono,
              o.num_factura,o.observaciones,o.fecha_programada,creado_por))
        oid = cur.fetchone()[0]
        conn.commit(); release_conn(conn)
        return {"ok": True, "id": oid, "consecutivo": consecutivo}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/ordenes/{oid}/iniciar")
def iniciar_orden(oid: int, lat: float = None, lng: float = None):
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            UPDATE ordenes_servicio SET estado='en_curso',
            fecha_inicio=NOW(), lat_inicio=%s, lng_inicio=%s
            WHERE id=%s
        """, (lat, lng, oid))
        conn.commit(); release_conn(conn)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/ordenes/{oid}/cerrar")
def cerrar_orden(oid: int):
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            UPDATE ordenes_servicio SET estado='cerrada', fecha_cierre=NOW(),
            duracion_min = EXTRACT(EPOCH FROM (NOW()-fecha_inicio))/60
            WHERE id=%s
        """, (oid,))
        conn.commit(); release_conn(conn)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/ordenes/{oid}/inspeccion")
def guardar_inspeccion(oid: int, items: list):
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("DELETE FROM inspeccion_piezas WHERE orden_id=%s", (oid,))
        for item in items:
            cur.execute("""
                INSERT INTO inspeccion_piezas (orden_id,pieza_id,nombre_pieza,estado,novedad_descripcion,accion_solicitada)
                VALUES (%s,%s,%s,%s,%s,%s)
            """, (oid,item.get("pieza_id"),item.get("nombre_pieza"),item.get("estado","ok"),
                  item.get("novedad_descripcion",""),item.get("accion_solicitada","ninguna")))
        cur.execute("UPDATE ordenes_servicio SET estado='inspeccion' WHERE id=%s AND estado='en_curso'", (oid,))
        conn.commit(); release_conn(conn)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/ordenes/{oid}/detalle")
def detalle_orden(oid: int):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT o.id, o.consecutivo, o.tipo_servicio, o.estado,
                   o.cliente_nombre, o.cliente_direccion, o.cliente_telefono,
                   o.num_factura, o.observaciones,
                   o.fecha_inicio, o.fecha_cierre, o.duracion_min,
                   o.lat_inicio, o.lng_inicio,
                   r.codigo as ref_codigo, r.nombre as ref_nombre, r.categoria as ref_categoria,
                   u.nombre as tecnico
            FROM ordenes_servicio o
            LEFT JOIN referencias r ON r.id = o.referencia_id
            LEFT JOIN usuarios u ON u.id = o.tecnico_id
            WHERE o.id = %s
        """, (oid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Orden no encontrada")

        cur.execute("SELECT * FROM inspeccion_piezas WHERE orden_id=%s ORDER BY id", (oid,))
        inspeccion = cur.fetchall()

        cur.execute("SELECT * FROM novedades_servicio WHERE orden_id=%s ORDER BY id", (oid,))
        novedades = cur.fetchall()

        return {
            "orden": {
                "id":              row[0],
                "consecutivo":     row[1],
                "tipo_servicio":   row[2],
                "estado":          row[3],
                "cliente_nombre":  row[4],
                "cliente_direccion": row[5],
                "cliente_telefono": row[6],
                "num_factura":     row[7],
                "observaciones":   row[8],
                "fecha_inicio":    str(row[9])  if row[9]  else "",
                "fecha_cierre":    str(row[10]) if row[10] else "",
                "duracion_min":    row[11],
                "lat_inicio":      float(row[12]) if row[12] else None,
                "lng_inicio":      float(row[13]) if row[13] else None,
                "referencia_codigo":   row[14],
                "referencia_nombre":   row[15],
                "referencia_categoria": row[16],
                "tecnico":         row[17],
            },
            "inspeccion": [
                {"id": i[0], "pieza_id": i[2], "nombre": i[3], "estado": i[4],
                 "novedad": i[6], "accion": i[7]}
                for i in inspeccion
            ],
            "novedades": [
                {"id": n[0], "descripcion": n[2], "tipo": n[3],
                 "accion": n[4], "timestamp": str(n[6])}
                for n in novedades
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)

@app.post("/novedades_servicio")
def crear_novedad(n: NovedadServicio):
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO novedades_servicio (orden_id,descripcion,tipo,accion,foto_url)
            VALUES (%s,%s,%s,%s,%s) RETURNING id
        """, (n.orden_id,n.descripcion,n.tipo,n.accion,n.foto_url))
        nid = cur.fetchone()[0]
        conn.commit(); release_conn(conn)
        return {"ok": True, "id": nid}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main_api:app", host="0.0.0.0", port=port, reload=False)
# ============================================================
# ENDPOINTS FOTOS - SUPABASE STORAGE
# ============================================================

@app.post("/ordenes/{orden_id}/fotos")
def upload_foto(orden_id: int, foto: FotoUpload):
    """Subir foto a Supabase Storage"""
    conn = None
    try:
        print(f"📸 Subiendo foto tipo '{foto.tipo}' para orden {orden_id}")
        
        if "," in foto.base64_data:
            header, data = foto.base64_data.split(",", 1)
            extension = "jpg" if "jpeg" in header or "jpg" in header else "png"
        else:
            data = foto.base64_data
            extension = "jpg"
        
        image_bytes = base64.b64decode(data)
        size_bytes = len(image_bytes)
        
        if size_bytes > 5 * 1024 * 1024:
            raise HTTPException(400, f"Foto muy grande: {size_bytes / 1024 / 1024:.2f}MB")
        
        timestamp = int(datetime.now().timestamp() * 1000)
        filename = f"orden-{orden_id}/{foto.tipo}-{timestamp}.{extension}"
        
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=filename,
            file=image_bytes,
            file_options={"content-type": f"image/{extension}"}
        )
        
        public_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(filename)
        
        conn = get_conn()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO fotos_servicios 
            (orden_id, tipo, url, storage_path, size_bytes, size_original, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, url, timestamp
        """, [orden_id, foto.tipo, public_url, filename, size_bytes, foto.size_original, json.dumps(foto.metadata)])
        
        result = cur.fetchone()
        conn.commit()
        
        compression_ratio = (1 - size_bytes / foto.size_original) * 100 if foto.size_original > 0 else 0
        
        return {
            "success": True,
            "id": result[0],
            "url": result[1],
            "timestamp": result[2].isoformat() if result[2] else None,
            "size_bytes": size_bytes,
            "compression_ratio": f"{compression_ratio:.1f}%"
        }
    
    except Exception as e:
        print(f"❌ Error: {e}")
        if conn:
            conn.rollback()
        raise HTTPException(500, f"Error: {str(e)}")
    finally:
        release_conn(conn)


@app.get("/ordenes/{orden_id}/fotos")
def get_fotos_orden(orden_id: int):
    """Listar fotos de una orden"""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, tipo, url, timestamp, size_bytes
            FROM fotos_servicios
            WHERE orden_id = %s
            ORDER BY timestamp ASC
        """, [orden_id])
        
        rows = cur.fetchall()
        return [{"id": r[0], "tipo": r[1], "url": r[2], "timestamp": r[3].isoformat() if r[3] else None, "size_bytes": r[4]} for r in rows]
    
    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")
    finally:
        release_conn(conn)




# ============================================================
# ENDPOINT: Generar PDF de reporte
# ============================================================
 
@app.get("/ordenes/{orden_id}/reporte-pdf")
def generar_reporte_pdf(orden_id: int):
    """
    Genera un PDF completo del reporte de servicio
    Incluye: datos, timeline, fotos, inspección, novedades
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        
        # Obtener datos de la orden
        cur.execute("""
            SELECT o.*, r.nombre as ref_nombre, r.categoria,
                   p.nombre as tecnico_nombre
            FROM ordenes_servicio o
            LEFT JOIN referencias r ON o.referencia_id = r.id
            LEFT JOIN usuarios p ON o.tecnico_id = p.id
            WHERE o.id = %s
        """, [orden_id])
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Orden no encontrada")
        
        cols = [d[0] for d in cur.description]
        orden = dict(zip(cols, row))
        
        # Obtener fotos
        cur.execute("""
            SELECT tipo, url, timestamp, size_bytes, metadata
            FROM fotos_servicios
            WHERE orden_id = %s
            ORDER BY timestamp
        """, [orden_id])
        fotos = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
        
        # Obtener inspección
        cur.execute("""
            SELECT nombre_pieza, estado, novedad_descripcion, accion_solicitada
            FROM inspeccion_piezas
            WHERE orden_id = %s
        """, [orden_id])
        inspeccion = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
        
        # Obtener novedades
        cur.execute("""
            SELECT tipo, descripcion, fecha_registro
            FROM novedades_servicio
            WHERE orden_id = %s
            ORDER BY fecha_registro
        """, [orden_id])
        novedades = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
        
        # ====================================================
        # GENERAR PDF
        # ====================================================
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        
        # Estilos personalizados
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor("#1E40AF"),
            spaceAfter=12,
            alignment=TA_CENTER
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor("#374151"),
            spaceAfter=10,
            spaceBefore=15
        )
        
        # ====================================================
        # TÍTULO
        # ====================================================
        story.append(Paragraph(f"REPORTE DE SERVICIO", title_style))
        story.append(Paragraph(f"{orden['consecutivo']}", styles['Normal']))
        story.append(Spacer(1, 0.3*inch))
        
        # ====================================================
        # INFORMACIÓN GENERAL
        # ====================================================
        story.append(Paragraph("INFORMACIÓN DEL SERVICIO", heading_style))
        
        # Estado
        estado_map = {
            "cerrada": ("COMPLETADO", colors.green),
            "no_ejecutada": ("NO EJECUTADO", colors.red),
            "cancelada": ("CANCELADO", colors.red)
        }
        estado_texto, estado_color = estado_map.get(orden['estado'], ("PENDIENTE", colors.orange))
        
        info_data = [
            ["Cliente:", orden['cliente_nombre']],
            ["Dirección:", orden['cliente_direccion'] or "N/A"],
            ["Teléfono:", orden['cliente_telefono'] or "N/A"],
            ["Referencia:", orden['ref_nombre'] or "N/A"],
            ["Categoría:", orden['categoria'] or "N/A"],
            ["Tipo Servicio:", orden['tipo_servicio'].upper() if orden['tipo_servicio'] else "N/A"],
            ["Técnico:", orden['tecnico_nombre'] or "No asignado"],
            ["Factura:", orden['num_factura'] or "N/A"],
            ["Estado:", estado_texto],
        ]
        
        # Calcular duración
        if orden['fecha_inicio'] and orden['fecha_cierre']:
            diff = orden['fecha_cierre'] - orden['fecha_inicio']
            hours = diff.seconds // 3600
            mins = (diff.seconds % 3600) // 60
            duracion = f"{hours}h {mins}min"
            info_data.append(["Duración:", duracion])
        
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor("#374151")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB"))
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.3*inch))
        
        # ====================================================
        # TIMELINE
        # ====================================================
        if orden['fecha_inicio'] or orden['fecha_cierre']:
            story.append(Paragraph("LÍNEA DE TIEMPO", heading_style))
            timeline_data = []
            
            if orden['fecha_inicio']:
                timeline_data.append([
                    "📍 Iniciado:",
                    orden['fecha_inicio'].strftime("%d/%m/%Y %H:%M")
                ])
                if orden.get('lat_inicio') and orden.get('lng_inicio'):
                    timeline_data.append([
                        "   GPS:",
                        f"{orden['lat_inicio']:.4f}, {orden['lng_inicio']:.4f}"
                    ])
            
            if len(inspeccion) > 0:
                problemas = len([p for p in inspeccion if p['estado'] != 'ok'])
                timeline_data.append([
                    "🔍 Inspección:",
                    f"{len(inspeccion)} piezas ({problemas} problema(s))"
                ])
            
            if orden['fecha_cierre']:
                timeline_data.append([
                    "✓ Finalizado:" if orden['estado'] == 'cerrada' else "✗ Cerrado:",
                    orden['fecha_cierre'].strftime("%d/%m/%Y %H:%M")
                ])
            
            timeline_table = Table(timeline_data, colWidths=[2*inch, 4*inch])
            timeline_table.setStyle(TableStyle([
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor("#6B7280"))
            ]))
            story.append(timeline_table)
            story.append(Spacer(1, 0.3*inch))
        
        # ====================================================
        # INSPECCIÓN
        # ====================================================
        if len(inspeccion) > 0:
            story.append(Paragraph("INSPECCIÓN DE PIEZAS", heading_style))
            
            insp_data = [["Pieza", "Estado", "Observación", "Acción"]]
            for pieza in inspeccion:
                estado_texto = {
                    'ok': '✓ OK',
                    'averiada': '⚠ Averiada',
                    'faltante': '✗ Faltante'
                }.get(pieza['estado'], pieza['estado'])
                
                accion_texto = {
                    'cambio': 'Cambio',
                    'garantia': 'Garantía',
                    'reparar': 'Reparar',
                    'ninguna': '-'
                }.get(pieza['accion_solicitada'], '-')
                
                insp_data.append([
                    pieza['nombre_pieza'],
                    estado_texto,
                    pieza['novedad_descripcion'] or '-',
                    accion_texto
                ])
            
            insp_table = Table(insp_data, colWidths=[1.5*inch, 1*inch, 2.5*inch, 1*inch])
            insp_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")])
            ]))
            story.append(insp_table)
            story.append(Spacer(1, 0.3*inch))
        
        # ====================================================
        # NOVEDADES
        # ====================================================
        if len(novedades) > 0:
            story.append(Paragraph("NOVEDADES REPORTADAS", heading_style))
            
            for i, nov in enumerate(novedades, 1):
                nov_text = f"<b>{i}. {nov['tipo'].upper() if nov['tipo'] else 'NOVEDAD'}</b><br/>"
                nov_text += f"{nov['descripcion']}<br/>"
                nov_text += f"<i>Fecha: {nov['fecha_registro'].strftime('%d/%m/%Y %H:%M')}</i>"
                story.append(Paragraph(nov_text, styles['Normal']))
                story.append(Spacer(1, 0.1*inch))
            
            story.append(Spacer(1, 0.2*inch))
        
        # ====================================================
        # FOTOS
        # ====================================================
        if len(fotos) > 0:
            story.append(PageBreak())
            story.append(Paragraph("GALERÍA DE FOTOS", heading_style))
            
            # Organizar fotos por tipo
            fotos_organizadas = {
                'fachada': [],
                'pieza_averiada': [],
                'producto_abierto': [],
                'producto_cerrado': [],
                'cliente': [],
                'no_ejecutada': []
            }
            
            for foto in fotos:
                tipo = foto['tipo']
                if tipo in fotos_organizadas:
                    fotos_organizadas[tipo].append(foto)
            
            # Foto Fachada
            if fotos_organizadas['fachada']:
                story.append(Paragraph("🏠 Foto de Fachada", styles['Heading3']))
                try:
                    img_data = requests.get(fotos_organizadas['fachada'][0]['url']).content
                    img = RLImage(BytesIO(img_data), width=4*inch, height=3*inch)
                    story.append(img)
                except:
                    story.append(Paragraph("[Imagen no disponible]", styles['Normal']))
                story.append(Spacer(1, 0.2*inch))
            
            # Fotos de Piezas Averiadas
            if fotos_organizadas['pieza_averiada']:
                story.append(Paragraph(f"⚠️ Piezas con Problemas ({len(fotos_organizadas['pieza_averiada'])})", styles['Heading3']))
                for foto in fotos_organizadas['pieza_averiada']:
                    metadata = foto.get('metadata', {})
                    nombre_pieza = metadata.get('pieza_nombre', 'Pieza') if isinstance(metadata, dict) else 'Pieza'
                    story.append(Paragraph(f"<b>{nombre_pieza}</b>", styles['Normal']))
                    try:
                        img_data = requests.get(foto['url']).content
                        img = RLImage(BytesIO(img_data), width=2.5*inch, height=2*inch)
                        story.append(img)
                    except:
                        story.append(Paragraph("[Imagen no disponible]", styles['Normal']))
                    story.append(Spacer(1, 0.15*inch))
            
            # Fotos de Ejecución
            if fotos_organizadas['producto_abierto'] or fotos_organizadas['producto_cerrado']:
                story.append(Paragraph("🔧 Trabajo Realizado", styles['Heading3']))
                fotos_trabajo = []
                if fotos_organizadas['producto_abierto']:
                    try:
                        img_data = requests.get(fotos_organizadas['producto_abierto'][0]['url']).content
                        img = RLImage(BytesIO(img_data), width=2.5*inch, height=2*inch)
                        fotos_trabajo.append([Paragraph("<b>Producto Abierto</b>", styles['Normal']), img])
                    except:
                        fotos_trabajo.append([Paragraph("<b>Producto Abierto</b>", styles['Normal']), "[No disponible]"])
                
                if fotos_organizadas['producto_cerrado']:
                    try:
                        img_data = requests.get(fotos_organizadas['producto_cerrado'][0]['url']).content
                        img = RLImage(BytesIO(img_data), width=2.5*inch, height=2*inch)
                        if len(fotos_trabajo) > 0:
                            fotos_trabajo[0].append(Paragraph("<b>Producto Cerrado</b>", styles['Normal']))
                            fotos_trabajo[0].append(img)
                        else:
                            fotos_trabajo.append([Paragraph("<b>Producto Cerrado</b>", styles['Normal']), img])
                    except:
                        pass
                
                if fotos_trabajo:
                    trabajo_table = Table(fotos_trabajo, colWidths=[1*inch, 2.5*inch, 1*inch, 2.5*inch])
                    story.append(trabajo_table)
                    story.append(Spacer(1, 0.2*inch))
            
            # Foto Cliente
            if fotos_organizadas['cliente']:
                story.append(Paragraph("👤 Cliente (quien recibió)", styles['Heading3']))
                try:
                    img_data = requests.get(fotos_organizadas['cliente'][0]['url']).content
                    img = RLImage(BytesIO(img_data), width=2.5*inch, height=3*inch)
                    story.append(img)
                except:
                    story.append(Paragraph("[Imagen no disponible]", styles['Normal']))
        
        # ====================================================
        # GENERAR PDF
        # ====================================================
        doc.build(story)
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=Reporte_{orden['consecutivo']}_{orden['cliente_nombre'].replace(' ', '_')}.pdf"
            }
        )
        
    except Exception as e:
        raise HTTPException(500, f"Error generando PDF: {str(e)}")
    finally:
        release_conn(conn)
 
        



# ============================================================
# ENDPOINT: Cerrar orden como no ejecutada
# ============================================================
@app.patch("/ordenes/{orden_id}/cerrar-no-ejecutada")
def cerrar_orden_no_ejecutada(orden_id: int):
    """
    Cierra una orden con estado 'no_ejecutada'
    Se llama cuando el tecnico determina que el producto no es armable
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            UPDATE ordenes_servicio
            SET estado = 'no_ejecutada',
                fecha_cierre = NOW(),
                duracion_min = EXTRACT(EPOCH FROM (NOW() - COALESCE(fecha_inicio, NOW()))) / 60
            WHERE id = %s
        """, [orden_id])
        conn.commit()
        return {"ok": True, "estado": "no_ejecutada"}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(500, f"Error: {str(e)}")
    finally:
        release_conn(conn)


# ============================================================
# ENDPOINT: Reporte completo JSON (para vista en frontend)
# ============================================================
@app.get("/ordenes/{orden_id}/reporte-completo")
def reporte_completo(orden_id: int):
    """
    Obtiene todos los datos de una orden para la vista de reporte en el frontend.
    Incluye: orden, fotos (URLs Supabase), inspeccion, novedades
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        # Datos de la orden
        cur.execute("""
            SELECT o.*, r.nombre as ref_nombre, r.categoria,
                   u.nombre as tecnico_nombre
            FROM ordenes_servicio o
            LEFT JOIN referencias r ON o.referencia_id = r.id
            LEFT JOIN usuarios u ON o.tecnico_id = u.id
            WHERE o.id = %s
        """, [orden_id])
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Orden no encontrada")
        cols = [d[0] for d in cur.description]
        orden = dict(zip(cols, row))
        # Serializar fechas
        for k, v in orden.items():
            if hasattr(v, "isoformat"):
                orden[k] = v.isoformat()

        # Fotos desde Supabase (URLs publicas)
        cur.execute("""
            SELECT id, tipo, url, timestamp, size_bytes, metadata
            FROM fotos_servicios
            WHERE orden_id = %s
            ORDER BY timestamp ASC
        """, [orden_id])
        cols_f = [d[0] for d in cur.description]
        fotos = []
        for r in cur.fetchall():
            f = dict(zip(cols_f, r))
            if f.get("timestamp"):
                f["timestamp"] = f["timestamp"].isoformat()
            fotos.append(f)

        # Inspeccion de piezas
        cur.execute("""
            SELECT nombre_pieza, estado, novedad_descripcion, accion_solicitada
            FROM inspeccion_piezas
            WHERE orden_id = %s
            ORDER BY id ASC
        """, [orden_id])
        cols_i = [d[0] for d in cur.description]
        inspeccion = [dict(zip(cols_i, r)) for r in cur.fetchall()]

        # Novedades
        cur.execute("""
            SELECT id, tipo, descripcion, accion, timestamp
            FROM novedades_servicio
            WHERE orden_id = %s
            ORDER BY timestamp ASC
        """, [orden_id])
        cols_n = [d[0] for d in cur.description]
        novedades = []
        for r in cur.fetchall():
            n = dict(zip(cols_n, r))
            if n.get("timestamp"):
                n["timestamp"] = n["timestamp"].isoformat()
            novedades.append(n)

        return {
            "orden": orden,
            "fotos": fotos,
            "inspeccion": inspeccion,
            "novedades": novedades
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")
    finally:
        release_conn(conn)
