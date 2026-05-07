import os
import json
from datetime import datetime, timedelta, time
import re
import hmac
import hashlib
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
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

try:
    from jose import jwt
except ModuleNotFoundError:
    jwt = None

try:
    from passlib.context import CryptContext
except ModuleNotFoundError:
    CryptContext = None

JWT_SECRET = os.getenv("JWT_SECRET", "apex-dev-secret-2026-cambiar")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 8

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") if CryptContext else None

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def crear_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    if jwt:
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    payload["exp"] = int(payload["exp"].timestamp())
    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url(signature)}"

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
    allow_origins=[
        "http://localhost:3000",
        "https://apex-api-qa.netlify.app",
        "https://apex-erp-prod.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor. Intenta de nuevo."}
    )

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"detail": "Recurso no encontrado"}
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
        else:
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
    "configuracion": ["access", "view", "create", "edit"],
    "nomina": ["access", "view", "create", "edit", "export"],
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
            "configuracion": {"access": True, "view": True, "create": True, "edit": True},
            "nomina": {"access": True, "view": True, "create": True, "edit": True, "export": True},
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
    ({"GET"}, r"^/config/(?:horarios-contrato|conceptos-nomina|parametros-tiempo|festivos-colombia)(?:/.*)?$", "configuracion", "view"),
    ({"POST", "PUT", "PATCH"}, r"^/config/(?:horarios-contrato|conceptos-nomina|parametros-tiempo|festivos-colombia)(?:/.*)?$", "configuracion", "edit"),
    ({"GET"}, r"^/nomina/(?:dashboard|quincenas|jornadas)(?:/.*)?$", "nomina", "view"),
    ({"POST"}, r"^/nomina/(?:procesar-diario|procesar-rango|liquidar-quincena)(?:/.*)?$", "nomina", "create"),
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


def parse_int_list(raw_value: Optional[str]) -> List[int]:
    if not raw_value:
        return []
    values = []
    for item in str(raw_value).split(","):
        item = item.strip()
        if not item:
            continue
        try:
            values.append(int(item))
        except Exception:
            continue
    return values


def role_code_from_name(name: str):
    sanitized = re.sub(r"[^a-z0-9]+", "_", (name or "").strip().lower()).strip("_")
    return sanitized or "rol"


def ensure_usuario_columns(cur, conn):
    statements = [
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS salario_base NUMERIC DEFAULT 0",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS id_interno TEXT DEFAULT ''",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT ''",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS documento TEXT DEFAULT ''",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tasa_extra NUMERIC DEFAULT 0",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username TEXT",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS horario_id INTEGER",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado_laboral TEXT DEFAULT 'activo'",
    ]
    for statement in statements:
        cur.execute(statement)
    conn.commit()


def ensure_vehiculo_columns(cur, conn):
    statements = [
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
    ]
    for statement in statements:
        cur.execute(statement)
    conn.commit()


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


DEFAULT_PARAMETROS_NOMINA = {
    "horario_nocturno_inicio": "21:00",
    "horario_nocturno_fin": "06:00",
    "tiempo_almuerzo_minutos": "60",
    "horas_ordinarias_dia": "8",
    "horas_ordinarias_semana": "48",
    "auxilio_transporte_mensual": "0",
    "tope_auxilio_transporte_mensual": "999999999",
}


DEFAULT_CONCEPTOS_NOMINA = [
    ("RN", "Recargo Nocturno", "recargo_ordinario", 35.0),
    ("RDF", "Recargo Dominical/Festivo", "recargo_ordinario", 75.0),
    ("RNDF", "Recargo Nocturno Dom/Fest", "recargo_ordinario", 110.0),
    ("HED", "Hora Extra Diurna", "hora_extra", 25.0),
    ("HEN", "Hora Extra Nocturna", "hora_extra", 75.0),
    ("HEDDF", "Hora Extra Diurna Dom/Fest", "hora_extra", 100.0),
    ("HENDF", "Hora Extra Nocturna Dom/Fest", "hora_extra", 150.0),
]


def parse_boolish(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "si", "yes"}


def parse_date_safe(value: str):
    return datetime.strptime(value, "%Y-%m-%d").date()


def parse_time_minutes(value: str):
    raw = (value or "").strip()
    if not raw:
        return None
    try:
        if "AM" in raw.upper() or "PM" in raw.upper():
            parsed = datetime.strptime(raw.upper(), "%I:%M %p")
            return parsed.hour * 60 + parsed.minute
        parsed = datetime.strptime(raw[:5], "%H:%M")
        return parsed.hour * 60 + parsed.minute
    except Exception:
        return None


def combine_date_and_time(day_value, time_value: str):
    minutes = parse_time_minutes(time_value)
    if minutes is None:
        return None
    base_day = day_value if hasattr(day_value, "year") else parse_date_safe(str(day_value))
    return datetime.combine(base_day, time(hour=minutes // 60, minute=minutes % 60))


def daterange(date_start, date_end):
    cursor = date_start
    while cursor <= date_end:
        yield cursor
        cursor += timedelta(days=1)


def ensure_nomina_schema(cur, conn):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS horarios_contrato (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            hora_entrada TEXT NOT NULL,
            hora_salida TEXT NOT NULL,
            hora_inicio_almuerzo TEXT DEFAULT '',
            hora_fin_almuerzo TEXT DEFAULT '',
            dias_laborables_json TEXT DEFAULT '[0,1,2,3,4]',
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS horario_id INTEGER")
    cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado_laboral TEXT DEFAULT 'activo'")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS conceptos_nomina (
            id SERIAL PRIMARY KEY,
            codigo TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            tipo TEXT NOT NULL,
            porcentaje NUMERIC DEFAULT 0,
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS parametros_tiempo (
            clave TEXT PRIMARY KEY,
            valor TEXT NOT NULL,
            descripcion TEXT DEFAULT ''
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS festivos_colombia (
            fecha DATE PRIMARY KEY,
            nombre TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jornadas_procesadas (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER REFERENCES usuarios(id),
            fecha DATE NOT NULL,
            horario_id INTEGER,
            ruta_id INTEGER,
            vehiculo_placa TEXT DEFAULT '',
            entrada_real TIMESTAMPTZ,
            salida_real TIMESTAMPTZ,
            almuerzo_inicio_real TIMESTAMPTZ,
            almuerzo_fin_real TIMESTAMPTZ,
            minutos_totales INTEGER DEFAULT 0,
            minutos_almuerzo INTEGER DEFAULT 0,
            minutos_ordinarios_diurnos INTEGER DEFAULT 0,
            minutos_ordinarios_nocturnos INTEGER DEFAULT 0,
            minutos_ordinarios_dom_fest_diurnos INTEGER DEFAULT 0,
            minutos_ordinarios_dom_fest_nocturnos INTEGER DEFAULT 0,
            minutos_extra_diurnos INTEGER DEFAULT 0,
            minutos_extra_nocturnos INTEGER DEFAULT 0,
            minutos_extra_dom_fest_diurnos INTEGER DEFAULT 0,
            minutos_extra_dom_fest_nocturnos INTEGER DEFAULT 0,
            alertas_json TEXT DEFAULT '[]',
            inconsistente BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (usuario_id, fecha)
        )
    """)
    cur.execute("ALTER TABLE jornadas_procesadas ADD COLUMN IF NOT EXISTS ruta_id INTEGER")
    cur.execute("ALTER TABLE jornadas_procesadas ADD COLUMN IF NOT EXISTS vehiculo_placa TEXT DEFAULT ''")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS nomina_quincenal (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER REFERENCES usuarios(id),
            fecha_inicio DATE NOT NULL,
            fecha_fin DATE NOT NULL,
            dias_trabajados INTEGER DEFAULT 0,
            salario_basico NUMERIC DEFAULT 0,
            salario_proporcional NUMERIC DEFAULT 0,
            auxilio_transporte NUMERIC DEFAULT 0,
            valor_RN NUMERIC DEFAULT 0,
            valor_RDF NUMERIC DEFAULT 0,
            valor_RNDF NUMERIC DEFAULT 0,
            valor_HED NUMERIC DEFAULT 0,
            valor_HEN NUMERIC DEFAULT 0,
            valor_HEDDF NUMERIC DEFAULT 0,
            valor_HENDF NUMERIC DEFAULT 0,
            total_devengado NUMERIC DEFAULT 0,
            deducciones NUMERIC DEFAULT 0,
            neto_pagar NUMERIC DEFAULT 0,
            alertas_json TEXT DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (usuario_id, fecha_inicio, fecha_fin)
        )
    """)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM horarios_contrato")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO horarios_contrato (
                nombre, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, dias_laborables_json, activo
            ) VALUES (%s, %s, %s, %s, %s, %s, TRUE)
        """, ("Jornada Administrativa", "08:00", "17:00", "12:00", "13:00", json.dumps([0, 1, 2, 3, 4])))

    for codigo, nombre, tipo, porcentaje in DEFAULT_CONCEPTOS_NOMINA:
        cur.execute("""
            INSERT INTO conceptos_nomina (codigo, nombre, tipo, porcentaje, activo)
            VALUES (%s, %s, %s, %s, TRUE)
            ON CONFLICT (codigo) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                tipo = EXCLUDED.tipo,
                porcentaje = EXCLUDED.porcentaje,
                activo = TRUE
        """, (codigo, nombre, tipo, porcentaje))

    for clave, valor in DEFAULT_PARAMETROS_NOMINA.items():
        cur.execute("""
            INSERT INTO parametros_tiempo (clave, valor, descripcion)
            VALUES (%s, %s, '')
            ON CONFLICT (clave) DO NOTHING
        """, (clave, valor))
    conn.commit()


def get_parametros_nomina(cur):
    ensure_nomina_schema(cur, cur.connection)
    cur.execute("SELECT clave, valor FROM parametros_tiempo")
    params = {row[0]: row[1] for row in cur.fetchall()}
    for key, value in DEFAULT_PARAMETROS_NOMINA.items():
        params.setdefault(key, value)
    return params


def get_conceptos_nomina(cur):
    ensure_nomina_schema(cur, cur.connection)
    cur.execute("SELECT codigo, porcentaje FROM conceptos_nomina WHERE activo = TRUE")
    return {row[0]: float(row[1] or 0) for row in cur.fetchall()}


def get_festivos_set(cur):
    ensure_nomina_schema(cur, cur.connection)
    cur.execute("SELECT fecha FROM festivos_colombia")
    return {row[0] for row in cur.fetchall()}


def is_domingo_o_festivo(day_value, festivos_set):
    return day_value.weekday() == 6 or day_value in festivos_set


def get_horario_ordinario_minutos(horario, params):
    if horario:
        entrada = parse_time_minutes(horario.get("hora_entrada"))
        salida = parse_time_minutes(horario.get("hora_salida"))
        if entrada is not None and salida is not None:
            total = salida - entrada
            if total <= 0:
                total += 24 * 60
            almuerzo_inicio = parse_time_minutes(horario.get("hora_inicio_almuerzo"))
            almuerzo_fin = parse_time_minutes(horario.get("hora_fin_almuerzo"))
            if almuerzo_inicio is not None and almuerzo_fin is not None:
                almuerzo = almuerzo_fin - almuerzo_inicio
                if almuerzo > 0:
                    total -= almuerzo
            return max(total, 0)
    return int(float(params.get("horas_ordinarias_dia", "8")) * 60)


def normalize_marcacion_tipo(tipo):
    value = (tipo or "").strip().upper()
    mapping = {
        "ENTRADA": "entrada",
        "INGRESO": "entrada",
        "SALIDA": "salida",
        "CIERRE": "salida",
        "ALMUERZO": "inicio_almuerzo",
        "INICIO_ALMUERZO": "inicio_almuerzo",
        "FIN_ALMUERZO": "fin_almuerzo",
        "RETORNO": "fin_almuerzo",
        "REGRESO": "fin_almuerzo",
    }
    return mapping.get(value, value.lower())


def split_paid_intervals(entrada_dt, salida_dt, almuerzo_inicio_dt, almuerzo_fin_dt, horario, params, alerts):
    if salida_dt <= entrada_dt:
        salida_dt += timedelta(days=1)

    if almuerzo_inicio_dt and almuerzo_inicio_dt < entrada_dt:
        almuerzo_inicio_dt += timedelta(days=1)
    if almuerzo_fin_dt and almuerzo_fin_dt < entrada_dt:
        almuerzo_fin_dt += timedelta(days=1)
    if almuerzo_inicio_dt and almuerzo_fin_dt and almuerzo_fin_dt <= almuerzo_inicio_dt:
        almuerzo_fin_dt += timedelta(days=1)

    if not almuerzo_inicio_dt or not almuerzo_fin_dt:
        default_break = int(params.get("tiempo_almuerzo_minutos", "60"))
        horario_inicio = horario.get("hora_inicio_almuerzo") if horario else ""
        horario_fin = horario.get("hora_fin_almuerzo") if horario else ""
        schedule_lunch_start = combine_date_and_time(entrada_dt.date(), horario_inicio) if horario_inicio else None
        schedule_lunch_end = combine_date_and_time(entrada_dt.date(), horario_fin) if horario_fin else None
        if schedule_lunch_start and schedule_lunch_end:
            if schedule_lunch_end <= schedule_lunch_start:
                schedule_lunch_end += timedelta(days=1)
            almuerzo_inicio_dt = schedule_lunch_start
            almuerzo_fin_dt = schedule_lunch_end
        else:
            midpoint = entrada_dt + (salida_dt - entrada_dt) / 2
            almuerzo_inicio_dt = midpoint - timedelta(minutes=default_break / 2)
            almuerzo_fin_dt = almuerzo_inicio_dt + timedelta(minutes=default_break)
        alerts.append("almuerzo_imputado")

    intervals = []
    if almuerzo_inicio_dt > entrada_dt:
        intervals.append((entrada_dt, min(almuerzo_inicio_dt, salida_dt)))
    if almuerzo_fin_dt < salida_dt:
        intervals.append((max(almuerzo_fin_dt, entrada_dt), salida_dt))
    intervals = [(start, end) for start, end in intervals if end > start]
    return intervals, almuerzo_inicio_dt, almuerzo_fin_dt


def split_by_ordinary_limit(intervals, ordinary_limit_minutes):
    result = []
    worked = 0
    for start, end in intervals:
        duration = int((end - start).total_seconds() // 60)
        if duration <= 0:
            continue
        if worked >= ordinary_limit_minutes:
            result.append((start, end, "extra"))
            worked += duration
            continue
        remaining_ordinary = ordinary_limit_minutes - worked
        if duration <= remaining_ordinary:
            result.append((start, end, "ordinario"))
            worked += duration
        else:
            cutoff = start + timedelta(minutes=remaining_ordinary)
            result.append((start, cutoff, "ordinario"))
            result.append((cutoff, end, "extra"))
            worked += duration
    return result


def segment_boundaries(start, end, params):
    boundaries = {start, end}
    night_start = parse_time_minutes(params.get("horario_nocturno_inicio", "21:00")) or (21 * 60)
    night_end = parse_time_minutes(params.get("horario_nocturno_fin", "06:00")) or (6 * 60)
    for day in daterange(start.date(), end.date()):
        boundaries.add(datetime.combine(day, time.min))
        boundaries.add(datetime.combine(day, time(hour=night_start // 60, minute=night_start % 60)))
        boundaries.add(datetime.combine(day, time(hour=night_end // 60, minute=night_end % 60)))
        boundaries.add(datetime.combine(day + timedelta(days=1), time.min))
    ordered = sorted(point for point in boundaries if start <= point <= end)
    return ordered


def classify_segment(day_value, dt_start, minutes, nature, festivos_set, params):
    night_start = parse_time_minutes(params.get("horario_nocturno_inicio", "21:00")) or (21 * 60)
    night_end = parse_time_minutes(params.get("horario_nocturno_fin", "06:00")) or (6 * 60)
    minute_of_day = dt_start.hour * 60 + dt_start.minute
    is_night = minute_of_day >= night_start or minute_of_day < night_end
    is_special = is_domingo_o_festivo(day_value, festivos_set)

    if nature == "ordinario" and not is_special and not is_night:
        return "minutos_ordinarios_diurnos", minutes
    if nature == "ordinario" and not is_special and is_night:
        return "minutos_ordinarios_nocturnos", minutes
    if nature == "ordinario" and is_special and not is_night:
        return "minutos_ordinarios_dom_fest_diurnos", minutes
    if nature == "ordinario" and is_special and is_night:
        return "minutos_ordinarios_dom_fest_nocturnos", minutes
    if nature == "extra" and not is_special and not is_night:
        return "minutos_extra_diurnos", minutes
    if nature == "extra" and not is_special and is_night:
        return "minutos_extra_nocturnos", minutes
    if nature == "extra" and is_special and not is_night:
        return "minutos_extra_dom_fest_diurnos", minutes
    return "minutos_extra_dom_fest_nocturnos", minutes


def process_single_day(cur, user_row, target_date, params, festivos_set, horarios_map):
    status = (user_row["estado_laboral"] or "activo").strip().lower()
    if status in {"suspendido", "vacaciones", "licencia remunerada", "licencia no remunerada", "incapacidad"}:
        return None

    aliases = []
    for candidate in [user_row.get("nombre"), user_row.get("username")]:
        value = (candidate or "").strip()
        if value and value not in aliases:
            aliases.append(value)
    if not aliases:
        return None

    cur.execute("""
        SELECT tipo_marca, hora, fecha, COALESCE(vehiculo_placa, ''), ruta_id
        FROM asistencia
        WHERE usuario = ANY(%s)
          AND fecha BETWEEN %s AND %s
        ORDER BY fecha, hora, id
    """, (aliases, target_date, target_date + timedelta(days=1)))
    marks = []
    for tipo, hora_value, fecha_value, vehiculo_placa, ruta_id in cur.fetchall():
        normalized = normalize_marcacion_tipo(tipo)
        marks.append({
            "tipo": normalized,
            "dt": combine_date_and_time(fecha_value, hora_value),
            "vehiculo_placa": vehiculo_placa or "",
            "ruta_id": ruta_id,
        })

    entrada = next((mark["dt"] for mark in marks if mark["tipo"] == "entrada" and mark["dt"] and mark["dt"].date() == target_date), None)
    if not entrada:
        return None

    salida = next((mark["dt"] for mark in marks if mark["tipo"] == "salida" and mark["dt"] and mark["dt"] > entrada), None)
    if not salida:
        return {
            "usuario_id": user_row["id"],
            "fecha": target_date,
            "alertas": ["sin_salida"],
            "inconsistente": True,
        }

    almuerzo_inicio = next((mark["dt"] for mark in marks if mark["tipo"] == "inicio_almuerzo" and mark["dt"] and entrada < mark["dt"] < salida), None)
    almuerzo_fin = next((mark["dt"] for mark in marks if mark["tipo"] == "fin_almuerzo" and mark["dt"] and almuerzo_inicio and mark["dt"] > almuerzo_inicio), None)

    alerts = []
    horario = horarios_map.get(user_row.get("horario_id"))
    intervals, almuerzo_inicio_real, almuerzo_fin_real = split_paid_intervals(
        entrada, salida, almuerzo_inicio, almuerzo_fin, horario, params, alerts
    )
    ordinary_limit = get_horario_ordinario_minutos(horario, params)
    classified_intervals = split_by_ordinary_limit(intervals, ordinary_limit)

    result = {
        "usuario_id": user_row["id"],
        "fecha": target_date,
        "horario_id": user_row.get("horario_id"),
        "ruta_id": next((mark.get("ruta_id") for mark in marks if mark.get("ruta_id")), None),
        "vehiculo_placa": next((mark.get("vehiculo_placa") for mark in marks if mark.get("vehiculo_placa")), ""),
        "entrada_real": entrada,
        "salida_real": salida,
        "almuerzo_inicio_real": almuerzo_inicio_real,
        "almuerzo_fin_real": almuerzo_fin_real,
        "minutos_totales": max(int((salida - entrada).total_seconds() // 60), 0),
        "minutos_almuerzo": max(int((almuerzo_fin_real - almuerzo_inicio_real).total_seconds() // 60), 0) if almuerzo_inicio_real and almuerzo_fin_real else 0,
        "minutos_ordinarios_diurnos": 0,
        "minutos_ordinarios_nocturnos": 0,
        "minutos_ordinarios_dom_fest_diurnos": 0,
        "minutos_ordinarios_dom_fest_nocturnos": 0,
        "minutos_extra_diurnos": 0,
        "minutos_extra_nocturnos": 0,
        "minutos_extra_dom_fest_diurnos": 0,
        "minutos_extra_dom_fest_nocturnos": 0,
        "alertas": alerts,
        "inconsistente": False,
    }

    for start, end, nature in classified_intervals:
        boundaries = segment_boundaries(start, end, params)
        for idx in range(len(boundaries) - 1):
            seg_start = boundaries[idx]
            seg_end = boundaries[idx + 1]
            if seg_end <= seg_start:
                continue
            minutes = int((seg_end - seg_start).total_seconds() // 60)
            bucket, amount = classify_segment(seg_start.date(), seg_start, minutes, nature, festivos_set, params)
            result[bucket] += amount

    return result


def upsert_jornada_procesada(cur, jornada):
    cur.execute("""
        INSERT INTO jornadas_procesadas (
            usuario_id, fecha, horario_id, ruta_id, vehiculo_placa, entrada_real, salida_real,
            almuerzo_inicio_real, almuerzo_fin_real, minutos_totales, minutos_almuerzo,
            minutos_ordinarios_diurnos, minutos_ordinarios_nocturnos,
            minutos_ordinarios_dom_fest_diurnos, minutos_ordinarios_dom_fest_nocturnos,
            minutos_extra_diurnos, minutos_extra_nocturnos,
            minutos_extra_dom_fest_diurnos, minutos_extra_dom_fest_nocturnos,
            alertas_json, inconsistente
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (usuario_id, fecha) DO UPDATE SET
            horario_id = EXCLUDED.horario_id,
            ruta_id = EXCLUDED.ruta_id,
            vehiculo_placa = EXCLUDED.vehiculo_placa,
            entrada_real = EXCLUDED.entrada_real,
            salida_real = EXCLUDED.salida_real,
            almuerzo_inicio_real = EXCLUDED.almuerzo_inicio_real,
            almuerzo_fin_real = EXCLUDED.almuerzo_fin_real,
            minutos_totales = EXCLUDED.minutos_totales,
            minutos_almuerzo = EXCLUDED.minutos_almuerzo,
            minutos_ordinarios_diurnos = EXCLUDED.minutos_ordinarios_diurnos,
            minutos_ordinarios_nocturnos = EXCLUDED.minutos_ordinarios_nocturnos,
            minutos_ordinarios_dom_fest_diurnos = EXCLUDED.minutos_ordinarios_dom_fest_diurnos,
            minutos_ordinarios_dom_fest_nocturnos = EXCLUDED.minutos_ordinarios_dom_fest_nocturnos,
            minutos_extra_diurnos = EXCLUDED.minutos_extra_diurnos,
            minutos_extra_nocturnos = EXCLUDED.minutos_extra_nocturnos,
            minutos_extra_dom_fest_diurnos = EXCLUDED.minutos_extra_dom_fest_diurnos,
            minutos_extra_dom_fest_nocturnos = EXCLUDED.minutos_extra_dom_fest_nocturnos,
            alertas_json = EXCLUDED.alertas_json,
            inconsistente = EXCLUDED.inconsistente
    """, (
        jornada["usuario_id"], jornada["fecha"], jornada.get("horario_id"), jornada.get("ruta_id"), jornada.get("vehiculo_placa", ""),
        jornada.get("entrada_real"), jornada.get("salida_real"),
        jornada.get("almuerzo_inicio_real"), jornada.get("almuerzo_fin_real"), jornada.get("minutos_totales", 0), jornada.get("minutos_almuerzo", 0),
        jornada.get("minutos_ordinarios_diurnos", 0), jornada.get("minutos_ordinarios_nocturnos", 0),
        jornada.get("minutos_ordinarios_dom_fest_diurnos", 0), jornada.get("minutos_ordinarios_dom_fest_nocturnos", 0),
        jornada.get("minutos_extra_diurnos", 0), jornada.get("minutos_extra_nocturnos", 0),
        jornada.get("minutos_extra_dom_fest_diurnos", 0), jornada.get("minutos_extra_dom_fest_nocturnos", 0),
        json.dumps(jornada.get("alertas", [])), jornada.get("inconsistente", False)
    ))

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
    pas: Optional[str] = Field(default="1234", alias="pass")
    rol: str
    role_id: Optional[int] = None
    horario_id: Optional[int] = None
    estado_laboral: Optional[str] = "activo"
    id_interno: str
    empresa: Optional[str] = "APEX"
    costo: Optional[float] = 0
    salario: Optional[float] = 0
    extra: Optional[float] = 0

    class Config:
        allow_population_by_field_name = True


class RoleCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    permissions: dict = {}
    activo: bool = True


class HorarioContratoCreate(BaseModel):
    nombre: str
    hora_entrada: str
    hora_salida: str
    hora_inicio_almuerzo: Optional[str] = ""
    hora_fin_almuerzo: Optional[str] = ""
    dias_laborables: List[int] = [0, 1, 2, 3, 4]
    activo: bool = True


class ConceptoNominaCreate(BaseModel):
    codigo: str
    nombre: str
    tipo: str
    porcentaje: float
    activo: bool = True


class ParametroTiempoUpdate(BaseModel):
    parametros: dict


class FestivoCreate(BaseModel):
    fecha: str
    nombre: str


class NominaProcesarRequest(BaseModel):
    fecha: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None


class NominaLiquidarRequest(BaseModel):
    fecha_inicio: str
    fecha_fin: str


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
            token = crear_token({
                "sub": str(row[0]),
                "username": row[3],
                "rol": row[2]
            })
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
                },
                "token": token
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
        ensure_nomina_schema(cur, conn)
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
                   COALESCE(costo_servicio, 0),
                   u.horario_id,
                   COALESCE(h.nombre, ''),
                   COALESCE(u.estado_laboral, 'activo')
            FROM usuarios u
            LEFT JOIN roles r ON r.id = u.role_id
            LEFT JOIN horarios_contrato h ON h.id = u.horario_id
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
                "horario_id": r[13], "horario_nombre": r[14],
                "estado_laboral": r[15],
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
        ensure_nomina_schema(cur, conn)
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
            (nombre, username, password, rol, role_id, horario_id, estado_laboral, documento, empresa, id_interno, costo_servicio, salario_base, tasa_extra)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (p.nombre, p.user, p.pas, role_code, role_id, p.horario_id, p.estado_laboral or "activo", p.doc, p.empresa, p.id_interno, p.costo, p.salario, p.extra))
        conn.commit()
        return {"ok": True, "id_interno": p.id_interno}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.get("/config/horarios-contrato")
def get_horarios_contrato(activo: Optional[bool] = None):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        query = """
            SELECT id, nombre, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, dias_laborables_json, activo
            FROM horarios_contrato
        """
        params = []
        if activo is not None:
            query += " WHERE activo = %s"
            params.append(activo)
        query += " ORDER BY nombre"
        cur.execute(query, params)
        rows = cur.fetchall()
        return [{
            "id": row[0],
            "nombre": row[1],
            "hora_entrada": row[2],
            "hora_salida": row[3],
            "hora_inicio_almuerzo": row[4] or "",
            "hora_fin_almuerzo": row[5] or "",
            "dias_laborables": json.loads(row[6] or "[]"),
            "activo": bool(row[7]),
        } for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


@app.post("/config/horarios-contrato")
def crear_horario_contrato(horario: HorarioContratoCreate):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        cur.execute("""
            INSERT INTO horarios_contrato (
                nombre, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, dias_laborables_json, activo
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            horario.nombre, horario.hora_entrada, horario.hora_salida,
            horario.hora_inicio_almuerzo or "", horario.hora_fin_almuerzo or "",
            json.dumps(horario.dias_laborables or [0, 1, 2, 3, 4]), horario.activo
        ))
        hid = cur.fetchone()[0]
        conn.commit()
        return {"ok": True, "id": hid}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.put("/config/horarios-contrato/{hid}")
def editar_horario_contrato(hid: int, horario: HorarioContratoCreate):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        cur.execute("""
            UPDATE horarios_contrato
            SET nombre = %s, hora_entrada = %s, hora_salida = %s,
                hora_inicio_almuerzo = %s, hora_fin_almuerzo = %s,
                dias_laborables_json = %s, activo = %s
            WHERE id = %s
        """, (
            horario.nombre, horario.hora_entrada, horario.hora_salida,
            horario.hora_inicio_almuerzo or "", horario.hora_fin_almuerzo or "",
            json.dumps(horario.dias_laborables or [0, 1, 2, 3, 4]), horario.activo, hid
        ))
        conn.commit()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.get("/config/conceptos-nomina")
def get_conceptos_nomina_config():
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        cur.execute("""
            SELECT id, codigo, nombre, tipo, porcentaje, activo
            FROM conceptos_nomina
            ORDER BY tipo, codigo
        """)
        return [{
            "id": row[0],
            "codigo": row[1],
            "nombre": row[2],
            "tipo": row[3],
            "porcentaje": float(row[4] or 0),
            "activo": bool(row[5]),
        } for row in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


@app.post("/config/conceptos-nomina")
def crear_concepto_nomina(concepto: ConceptoNominaCreate):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        cur.execute("""
            INSERT INTO conceptos_nomina (codigo, nombre, tipo, porcentaje, activo)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (concepto.codigo.upper(), concepto.nombre, concepto.tipo, concepto.porcentaje, concepto.activo))
        cid = cur.fetchone()[0]
        conn.commit()
        return {"ok": True, "id": cid}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.put("/config/conceptos-nomina/{cid}")
def editar_concepto_nomina(cid: int, concepto: ConceptoNominaCreate):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        cur.execute("""
            UPDATE conceptos_nomina
            SET codigo = %s, nombre = %s, tipo = %s, porcentaje = %s, activo = %s
            WHERE id = %s
        """, (concepto.codigo.upper(), concepto.nombre, concepto.tipo, concepto.porcentaje, concepto.activo, cid))
        conn.commit()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.get("/config/parametros-tiempo")
def get_parametros_tiempo_config():
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        params = get_parametros_nomina(cur)
        return params
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


@app.post("/config/parametros-tiempo")
def guardar_parametros_tiempo(payload: ParametroTiempoUpdate):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        for key, value in (payload.parametros or {}).items():
            cur.execute("""
                INSERT INTO parametros_tiempo (clave, valor, descripcion)
                VALUES (%s, %s, '')
                ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor
            """, (key, str(value)))
        conn.commit()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.get("/config/festivos-colombia")
def get_festivos_colombia(anio: Optional[int] = None):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        if anio:
            cur.execute("SELECT fecha, nombre FROM festivos_colombia WHERE EXTRACT(YEAR FROM fecha) = %s ORDER BY fecha", (anio,))
        else:
            cur.execute("SELECT fecha, nombre FROM festivos_colombia ORDER BY fecha DESC")
        return [{"fecha": str(row[0]), "nombre": row[1]} for row in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


@app.post("/config/festivos-colombia")
def crear_festivo_colombia(festivo: FestivoCreate):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        cur.execute("""
            INSERT INTO festivos_colombia (fecha, nombre)
            VALUES (%s, %s)
            ON CONFLICT (fecha) DO UPDATE SET nombre = EXCLUDED.nombre
        """, (festivo.fecha, festivo.nombre))
        conn.commit()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


def fetch_users_for_nomina(cur):
    ensure_nomina_schema(cur, cur.connection)
    cur.execute("""
        SELECT u.id, u.nombre, COALESCE(u.username, ''), COALESCE(u.salario_base, 0), COALESCE(u.horario_id, NULL), COALESCE(u.estado_laboral, 'activo')
        FROM usuarios u
        WHERE COALESCE(u.activo, TRUE) = TRUE
    """)
    return [{
        "id": row[0],
        "nombre": row[1],
        "username": row[2] or "",
        "salario_base": float(row[3] or 0),
        "horario_id": row[4],
        "estado_laboral": row[5] or "activo",
    } for row in cur.fetchall()]


def fetch_horarios_map(cur):
    ensure_nomina_schema(cur, cur.connection)
    cur.execute("""
        SELECT id, nombre, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, dias_laborables_json, activo
        FROM horarios_contrato
    """)
    rows = cur.fetchall()
    return {
        row[0]: {
            "id": row[0],
            "nombre": row[1],
            "hora_entrada": row[2],
            "hora_salida": row[3],
            "hora_inicio_almuerzo": row[4] or "",
            "hora_fin_almuerzo": row[5] or "",
            "dias_laborables": json.loads(row[6] or "[]"),
            "activo": bool(row[7]),
        }
        for row in rows
    }


def liquidar_usuario(cur, user_row, fecha_inicio, fecha_fin, params, conceptos):
    cur.execute("""
        SELECT
            COALESCE(SUM(minutos_ordinarios_nocturnos), 0),
            COALESCE(SUM(minutos_ordinarios_dom_fest_diurnos), 0),
            COALESCE(SUM(minutos_ordinarios_dom_fest_nocturnos), 0),
            COALESCE(SUM(minutos_extra_diurnos), 0),
            COALESCE(SUM(minutos_extra_nocturnos), 0),
            COALESCE(SUM(minutos_extra_dom_fest_diurnos), 0),
            COALESCE(SUM(minutos_extra_dom_fest_nocturnos), 0),
            COUNT(*),
            COALESCE(json_agg(alertas_json) FILTER (WHERE alertas_json IS NOT NULL), '[]')
        FROM jornadas_procesadas
        WHERE usuario_id = %s
          AND fecha BETWEEN %s AND %s
    """, (user_row["id"], fecha_inicio, fecha_fin))
    row = cur.fetchone()
    if not row:
        return None

    valor_hora = float(user_row["salario_base"] or 0) / 240 if user_row["salario_base"] else 0
    dias_trabajados = int(row[7] or 0)
    salario_proporcional = round((float(user_row["salario_base"] or 0) / 30) * dias_trabajados, 2)
    auxilio_mensual = float(params.get("auxilio_transporte_mensual", "0") or 0)
    tope_auxilio = float(params.get("tope_auxilio_transporte_mensual", "999999999") or 999999999)
    auxilio_transporte = round((auxilio_mensual / 30) * dias_trabajados, 2) if user_row["salario_base"] <= tope_auxilio else 0

    valores = {
        "RN": round((row[0] / 60.0) * valor_hora * (conceptos.get("RN", 0) / 100.0), 2),
        "RDF": round((row[1] / 60.0) * valor_hora * (conceptos.get("RDF", 0) / 100.0), 2),
        "RNDF": round((row[2] / 60.0) * valor_hora * (conceptos.get("RNDF", 0) / 100.0), 2),
        "HED": round((row[3] / 60.0) * valor_hora * (1 + conceptos.get("HED", 0) / 100.0), 2),
        "HEN": round((row[4] / 60.0) * valor_hora * (1 + conceptos.get("HEN", 0) / 100.0), 2),
        "HEDDF": round((row[5] / 60.0) * valor_hora * (1 + conceptos.get("HEDDF", 0) / 100.0), 2),
        "HENDF": round((row[6] / 60.0) * valor_hora * (1 + conceptos.get("HENDF", 0) / 100.0), 2),
    }
    total_devengado = round(salario_proporcional + auxilio_transporte + sum(valores.values()), 2)
    deducciones = 0.0
    neto = round(total_devengado - deducciones, 2)
    alertas = []
    if dias_trabajados == 0:
        alertas.append("sin_jornadas")

    cur.execute("""
        INSERT INTO nomina_quincenal (
            usuario_id, fecha_inicio, fecha_fin, dias_trabajados, salario_basico, salario_proporcional,
            auxilio_transporte, valor_RN, valor_RDF, valor_RNDF, valor_HED, valor_HEN, valor_HEDDF, valor_HENDF,
            total_devengado, deducciones, neto_pagar, alertas_json
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (usuario_id, fecha_inicio, fecha_fin) DO UPDATE SET
            dias_trabajados = EXCLUDED.dias_trabajados,
            salario_basico = EXCLUDED.salario_basico,
            salario_proporcional = EXCLUDED.salario_proporcional,
            auxilio_transporte = EXCLUDED.auxilio_transporte,
            valor_RN = EXCLUDED.valor_RN,
            valor_RDF = EXCLUDED.valor_RDF,
            valor_RNDF = EXCLUDED.valor_RNDF,
            valor_HED = EXCLUDED.valor_HED,
            valor_HEN = EXCLUDED.valor_HEN,
            valor_HEDDF = EXCLUDED.valor_HEDDF,
            valor_HENDF = EXCLUDED.valor_HENDF,
            total_devengado = EXCLUDED.total_devengado,
            deducciones = EXCLUDED.deducciones,
            neto_pagar = EXCLUDED.neto_pagar,
            alertas_json = EXCLUDED.alertas_json
    """, (
        user_row["id"], fecha_inicio, fecha_fin, dias_trabajados, user_row["salario_base"], salario_proporcional,
        auxilio_transporte, valores["RN"], valores["RDF"], valores["RNDF"], valores["HED"], valores["HEN"], valores["HEDDF"], valores["HENDF"],
        total_devengado, deducciones, neto, json.dumps(alertas)
    ))
    return {
        "usuario_id": user_row["id"],
        "empleado": user_row["nombre"],
        "dias_trabajados": dias_trabajados,
        "salario_proporcional": salario_proporcional,
        "auxilio_transporte": auxilio_transporte,
        "total_devengado": total_devengado,
        "neto_pagar": neto,
        **valores,
    }


@app.post("/nomina/procesar-diario")
def procesar_nomina_diaria(payload: NominaProcesarRequest):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        fecha = parse_date_safe(payload.fecha or datetime.now().strftime("%Y-%m-%d"))
        params = get_parametros_nomina(cur)
        festivos_set = get_festivos_set(cur)
        horarios_map = fetch_horarios_map(cur)
        users = fetch_users_for_nomina(cur)

        procesadas = []
        for user_row in users:
            jornada = process_single_day(cur, user_row, fecha, params, festivos_set, horarios_map)
            if jornada:
                upsert_jornada_procesada(cur, jornada)
                procesadas.append(jornada)
        conn.commit()
        return {"ok": True, "fecha": str(fecha), "procesadas": len(procesadas)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.post("/nomina/procesar-rango")
def procesar_nomina_rango(payload: NominaProcesarRequest):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        fecha_inicio = parse_date_safe(payload.fecha_inicio)
        fecha_fin = parse_date_safe(payload.fecha_fin)
        params = get_parametros_nomina(cur)
        festivos_set = get_festivos_set(cur)
        horarios_map = fetch_horarios_map(cur)
        users = fetch_users_for_nomina(cur)
        total = 0
        for day in daterange(fecha_inicio, fecha_fin):
            for user_row in users:
                jornada = process_single_day(cur, user_row, day, params, festivos_set, horarios_map)
                if jornada:
                    upsert_jornada_procesada(cur, jornada)
                    total += 1
        conn.commit()
        return {"ok": True, "fecha_inicio": str(fecha_inicio), "fecha_fin": str(fecha_fin), "procesadas": total}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.post("/nomina/liquidar-quincena")
def liquidar_nomina_quincenal(payload: NominaLiquidarRequest):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        fecha_inicio = parse_date_safe(payload.fecha_inicio)
        fecha_fin = parse_date_safe(payload.fecha_fin)
        params = get_parametros_nomina(cur)
        conceptos = get_conceptos_nomina(cur)
        users = fetch_users_for_nomina(cur)
        liquidaciones = []
        for user_row in users:
            liq = liquidar_usuario(cur, user_row, fecha_inicio, fecha_fin, params, conceptos)
            if liq:
                liquidaciones.append(liq)
        conn.commit()
        return {"ok": True, "fecha_inicio": str(fecha_inicio), "fecha_fin": str(fecha_fin), "liquidaciones": liquidaciones}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_conn(conn)


@app.get("/nomina/quincenas")
def get_nomina_quincenas(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    usuario_ids: Optional[str] = None,
):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        query = """
            SELECT n.id, n.usuario_id, u.nombre, n.fecha_inicio, n.fecha_fin, n.dias_trabajados,
                   n.salario_basico, n.salario_proporcional, n.auxilio_transporte,
                   n.valor_RN, n.valor_RDF, n.valor_RNDF, n.valor_HED, n.valor_HEN, n.valor_HEDDF, n.valor_HENDF,
                   n.total_devengado, n.deducciones, n.neto_pagar, n.alertas_json
            FROM nomina_quincenal n
            JOIN usuarios u ON u.id = n.usuario_id
        """
        params = []
        conditions = []
        user_ids = parse_int_list(usuario_ids)
        if fecha_inicio:
            conditions.append("n.fecha_inicio >= %s")
            params.append(fecha_inicio)
        if fecha_fin:
            conditions.append("n.fecha_fin <= %s")
            params.append(fecha_fin)
        if user_ids:
            conditions.append("n.usuario_id = ANY(%s)")
            params.append(user_ids)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY n.fecha_fin DESC, u.nombre"
        cur.execute(query, params)
        rows = cur.fetchall()
        return [{
            "id": row[0],
            "usuario_id": row[1],
            "empleado": row[2],
            "fecha_inicio": str(row[3]),
            "fecha_fin": str(row[4]),
            "dias_trabajados": row[5],
            "salario_basico": float(row[6] or 0),
            "salario_proporcional": float(row[7] or 0),
            "auxilio_transporte": float(row[8] or 0),
            "valor_RN": float(row[9] or 0),
            "valor_RDF": float(row[10] or 0),
            "valor_RNDF": float(row[11] or 0),
            "valor_HED": float(row[12] or 0),
            "valor_HEN": float(row[13] or 0),
            "valor_HEDDF": float(row[14] or 0),
            "valor_HENDF": float(row[15] or 0),
            "total_devengado": float(row[16] or 0),
            "deducciones": float(row[17] or 0),
            "neto_pagar": float(row[18] or 0),
            "alertas": json.loads(row[19] or "[]"),
        } for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


@app.get("/nomina/jornadas")
def get_jornadas_procesadas(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    usuario_ids: Optional[str] = None,
):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        query = """
            SELECT j.id, j.usuario_id, u.nombre, COALESCE(u.estado_laboral, 'activo'), j.fecha, j.minutos_totales, j.minutos_almuerzo,
                   j.minutos_ordinarios_diurnos, j.minutos_ordinarios_nocturnos,
                   j.minutos_ordinarios_dom_fest_diurnos, j.minutos_ordinarios_dom_fest_nocturnos,
                   j.minutos_extra_diurnos, j.minutos_extra_nocturnos,
                   j.minutos_extra_dom_fest_diurnos, j.minutos_extra_dom_fest_nocturnos,
                   j.alertas_json, j.inconsistente, j.ruta_id, COALESCE(j.vehiculo_placa, ''),
                   COALESCE(h.nombre, '')
            FROM jornadas_procesadas j
            JOIN usuarios u ON u.id = j.usuario_id
            LEFT JOIN horarios_contrato h ON h.id = j.horario_id
        """
        params = []
        conditions = []
        user_ids = parse_int_list(usuario_ids)
        if fecha_inicio:
            conditions.append("j.fecha >= %s")
            params.append(fecha_inicio)
        if fecha_fin:
            conditions.append("j.fecha <= %s")
            params.append(fecha_fin)
        if user_ids:
            conditions.append("j.usuario_id = ANY(%s)")
            params.append(user_ids)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY j.fecha DESC, u.nombre"
        cur.execute(query, params)
        rows = cur.fetchall()
        return [{
            "id": row[0], "usuario_id": row[1], "empleado": row[2], "estado_laboral": row[3], "fecha": str(row[4]),
            "minutos_totales": row[5], "minutos_almuerzo": row[6],
            "minutos_ordinarios_diurnos": row[7], "minutos_ordinarios_nocturnos": row[8],
            "minutos_ordinarios_dom_fest_diurnos": row[9], "minutos_ordinarios_dom_fest_nocturnos": row[10],
            "minutos_extra_diurnos": row[11], "minutos_extra_nocturnos": row[12],
            "minutos_extra_dom_fest_diurnos": row[13], "minutos_extra_dom_fest_nocturnos": row[14],
            "alertas": json.loads(row[15] or "[]"), "inconsistente": bool(row[16]),
            "ruta_id": row[17], "vehiculo_placa": row[18], "horario_nombre": row[19],
        } for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


@app.get("/nomina/dashboard")
def get_nomina_dashboard(fecha_inicio: str, fecha_fin: str, usuario_ids: Optional[str] = None):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_nomina_schema(cur, conn)
        fecha_ini = parse_date_safe(fecha_inicio)
        fecha_fin_date = parse_date_safe(fecha_fin)
        user_ids = parse_int_list(usuario_ids)
        quincena_user_filter = ""
        jornada_user_filter = ""
        params_quincena = [fecha_ini, fecha_fin_date]
        params_jornadas = [fecha_ini, fecha_fin_date]
        if user_ids:
            quincena_user_filter = " AND usuario_id = ANY(%s)"
            jornada_user_filter = " AND j.usuario_id = ANY(%s)"
            params_quincena.append(user_ids)
            params_jornadas.append(user_ids)

        cur.execute(f"""
            SELECT
                COALESCE(SUM(total_devengado), 0),
                COALESCE(SUM(salario_proporcional), 0),
                COALESCE(SUM(valor_HED + valor_HEN + valor_HEDDF + valor_HENDF), 0)
            FROM nomina_quincenal
            WHERE fecha_inicio = %s AND fecha_fin = %s
            {quincena_user_filter}
        """, params_quincena)
        totales = cur.fetchone()
        total_nomina = float(totales[0] or 0)
        total_salario = float(totales[1] or 0)
        total_extras = float(totales[2] or 0)
        porcentaje_extras = round((total_extras / total_salario) * 100, 2) if total_salario else 0

        cur.execute(f"""
            SELECT
                date_trunc('week', fecha)::date AS semana,
                COALESCE(SUM(minutos_extra_diurnos + minutos_extra_nocturnos + minutos_extra_dom_fest_diurnos + minutos_extra_dom_fest_nocturnos), 0)
            FROM jornadas_procesadas
            WHERE fecha BETWEEN %s AND %s
            {jornada_user_filter.replace('j.', '')}
            GROUP BY 1
            ORDER BY 1
        """, params_jornadas)
        por_semana = [{"semana": str(row[0]), "minutos_extra": int(row[1] or 0)} for row in cur.fetchall()]

        cur.execute(f"""
            SELECT
                COALESCE(SUM(valor_RN), 0), COALESCE(SUM(valor_RDF), 0), COALESCE(SUM(valor_RNDF), 0),
                COALESCE(SUM(valor_HED), 0), COALESCE(SUM(valor_HEN), 0), COALESCE(SUM(valor_HEDDF), 0), COALESCE(SUM(valor_HENDF), 0)
            FROM nomina_quincenal
            WHERE fecha_inicio = %s AND fecha_fin = %s
            {quincena_user_filter}
        """, params_quincena)
        c = cur.fetchone()
        conceptos = {
            "RN": float(c[0] or 0), "RDF": float(c[1] or 0), "RNDF": float(c[2] or 0),
            "HED": float(c[3] or 0), "HEN": float(c[4] or 0), "HEDDF": float(c[5] or 0), "HENDF": float(c[6] or 0),
        }

        cur.execute(f"""
            SELECT u.nombre, COALESCE(SUM(j.minutos_extra_diurnos + j.minutos_extra_nocturnos + j.minutos_extra_dom_fest_diurnos + j.minutos_extra_dom_fest_nocturnos), 0)
            FROM jornadas_procesadas j
            JOIN usuarios u ON u.id = j.usuario_id
            WHERE j.fecha BETWEEN %s AND %s
            {jornada_user_filter}
            GROUP BY u.nombre
            HAVING COALESCE(SUM(j.minutos_extra_diurnos + j.minutos_extra_nocturnos + j.minutos_extra_dom_fest_diurnos + j.minutos_extra_dom_fest_nocturnos), 0) > 720
            ORDER BY 2 DESC
        """, params_jornadas)
        extras_alert = [{"empleado": row[0], "minutos_extra": int(row[1] or 0)} for row in cur.fetchall()]

        cur.execute(f"""
            SELECT u.nombre, j.fecha, j.alertas_json
            FROM jornadas_procesadas j
            JOIN usuarios u ON u.id = j.usuario_id
            WHERE j.fecha BETWEEN %s AND %s
              {jornada_user_filter}
              AND (j.inconsistente = TRUE OR j.alertas_json <> '[]')
            ORDER BY j.fecha DESC
        """, params_jornadas)
        inconsistentes = [{
            "empleado": row[0],
            "fecha": str(row[1]),
            "alertas": json.loads(row[2] or "[]"),
        } for row in cur.fetchall()]

        users = fetch_users_for_nomina(cur)
        if user_ids:
            users = [user_row for user_row in users if user_row["id"] in user_ids]
        horarios_map = fetch_horarios_map(cur)
        ausencias = []
        for day in daterange(fecha_ini, fecha_fin_date):
            if user_ids:
                cur.execute("SELECT usuario_id FROM jornadas_procesadas WHERE fecha = %s AND usuario_id = ANY(%s)", (day, user_ids))
            else:
                cur.execute("SELECT usuario_id FROM jornadas_procesadas WHERE fecha = %s", (day,))
            presentes = {row[0] for row in cur.fetchall()}
            for user_row in users:
                estado_laboral = (user_row.get("estado_laboral") or "activo").strip().lower()
                if estado_laboral != "activo":
                    continue
                horario = horarios_map.get(user_row.get("horario_id"))
                dias_laborables = horario.get("dias_laborables", [0, 1, 2, 3, 4]) if horario else [0, 1, 2, 3, 4]
                if day.weekday() in dias_laborables and user_row["id"] not in presentes:
                    ausencias.append({"empleado": user_row["nombre"], "fecha": str(day)})

        return {
            "total_nomina": total_nomina,
            "porcentaje_extras_sobre_salario": porcentaje_extras,
            "analisis_semana": por_semana,
            "desglose_conceptos": conceptos,
            "alertas": {
                "empleados_mas_12h_extra": extras_alert,
                "jornadas_inconsistentes": inconsistentes,
                "ausencias_sin_validar": ausencias,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
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
def get_asistencia(
    fecha: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    usuario: Optional[str] = None,
    hoy: Optional[str] = None
):
    try:
        conn = get_conn()
        cur = conn.cursor()
        f = fecha or datetime.now().strftime("%Y-%m-%d")
        if hoy == "1":
            f = datetime.now().strftime("%Y-%m-%d")
        if fecha_inicio or fecha_fin:
            query = "SELECT usuario, vehiculo_placa, tipo_marca, hora, fecha FROM asistencia WHERE 1=1"
            params = []
            if fecha_inicio:
                query += " AND fecha >= %s::date"
                params.append(fecha_inicio)
            if fecha_fin:
                query += " AND fecha < (%s::date + INTERVAL '1 day')"
                params.append(fecha_fin)
        else:
            query = "SELECT usuario, vehiculo_placa, tipo_marca, hora, fecha FROM asistencia WHERE fecha::text = %s"
            params = [f]
        if usuario:
            query += " AND usuario = %s"
            params.append(usuario)
        query += " ORDER BY fecha DESC, hora DESC, id DESC"
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

        ensure_usuario_columns(cur, conn)
        ensure_vehiculo_columns(cur, conn)
        ensure_roles_schema(cur, conn)
        ensure_nomina_schema(cur, conn)

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
        ensure_nomina_schema(cur, conn)
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
                costo_servicio = %s, horario_id = %s, estado_laboral = %s
            WHERE id = %s
        """, (p.nombre, p.doc, p.empresa,
              float(p.salario or 0), float(p.extra or 0), role_code, role_id,
              float(p.costo or 0), p.horario_id, p.estado_laboral or "activo", uid))
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
def get_ordenes(
    estado: str = None,
    tecnico_id: int = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
):
    conn = None
    try:
        conn = get_conn(); cur = conn.cursor()
        conditions = []
        params = []
        if estado:
            conditions.append("o.estado = %s"); params.append(estado)
        if tecnico_id:
            conditions.append("o.tecnico_id = %s"); params.append(tecnico_id)
        if fecha_inicio:
            conditions.append("o.fecha_creacion >= %s::date")
            params.append(fecha_inicio)
        if fecha_fin:
            conditions.append("o.fecha_creacion < (%s::date + INTERVAL '1 day')")
            params.append(fecha_fin)
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
