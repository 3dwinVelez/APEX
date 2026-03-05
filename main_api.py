import os
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import psycopg2
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="APEX ERP API", version="2.0")

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
            maxconn=10,
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
    get_pool().putconn(conn)

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
    id_interno: str
    empresa: Optional[str] = "APEX"
    costo: Optional[float] = 0
    salario: Optional[float] = 0
    extra: Optional[float] = 0

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

    fecha: str
    placa: str
    empleados: list
    h_inicio: Optional[str] = "08:00 AM"
    h_fin: Optional[str] = "06:00 PM"

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
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, nombre, rol, username FROM usuarios WHERE username = %s AND password = %s",
            (req.username, req.password)
        )
        row = cur.fetchone()
        release_conn(conn)
        if row:
            return {
                "usuario": {
                    "id": row[0],
                    "nombre": row[1],
                    "rol": row[2],
                    "username": row[3]
                }
            }
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# PERSONAL
# ============================================================
@app.get("/personal")
def get_personal():
    try:
        conn = get_conn()
        cur = conn.cursor()
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
            SELECT id, nombre, rol,
                   COALESCE(salario_base, 0),
                   COALESCE(id_interno, ''),
                   COALESCE(empresa, ''),
                   COALESCE(documento, ''),
                   COALESCE(tasa_extra, 0),
                   COALESCE(username, ''),
                   COALESCE(activo, TRUE)
            FROM usuarios ORDER BY nombre
        """)
        rows = cur.fetchall()
        release_conn(conn)
        return [
            {
                "id": r[0], "nombre": r[1], "rol": r[2],
                "salario_base": float(r[3]) if r[3] else 0,
                "id_interno": r[4], "empresa": r[5],
                "documento": r[6], "tasa_extra": float(r[7]) if r[7] else 0,
                "username": r[8], "activo": bool(r[9])
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/personal")
def crear_personal(p: PersonalCreate):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO usuarios
            (nombre, username, password, rol, documento, empresa, id_interno, costo_servicio, salario_base, tasa_extra)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (p.nombre, p.user, p.pas, p.rol, p.doc, p.empresa, p.id_interno, p.costo, p.salario, p.extra))
        conn.commit()
        release_conn(conn)
        return {"ok": True, "id_interno": p.id_interno}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
        if fecha:
            cur.execute("""
                SELECT vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog, fecha
                FROM planeacion_rutas WHERE fecha = %s ORDER BY id DESC
            """, (fecha,))
        else:
            fecha_hoy = datetime.now().strftime("%Y-%m-%d")
            cur.execute("""
                SELECT vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog, fecha
                FROM planeacion_rutas WHERE fecha = %s ORDER BY id DESC
            """, (fecha_hoy,))
        rows = cur.fetchall()
        release_conn(conn)
        result = []
        for r in rows:
            try:
                empleados = json.loads(r[1]) if r[1] else []
                result.append({"placa": r[0], "equipo": empleados, "h_inicio": r[2], "h_fin": r[3], "fecha": r[4]})
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
def get_asistencia(fecha: Optional[str] = None):
    try:
        conn = get_conn()
        cur = conn.cursor()
        f = fecha or datetime.now().strftime("%Y-%m-%d")
        cur.execute("""
            SELECT usuario, vehiculo_placa, tipo_marca, hora, fecha
            FROM asistencia WHERE fecha = %s ORDER BY id
        """, (f,))
        rows = cur.fetchall()
        release_conn(conn)
        return [{"usuario": r[0], "placa": r[1], "tipo": r[2], "hora": r[3], "fecha": r[4]} for r in rows]
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
    vehiculo_placa: str
    tipo_marca: str  # INGRESO | ALMUERZO | RETORNO | CIERRE
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    ruta_id: Optional[int] = None
    novedad_tipo_id: Optional[int] = None
    novedad_descripcion: Optional[str] = None

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
    try:
        conn = get_conn()
        cur = conn.cursor()
        f = fecha or datetime.now().strftime("%Y-%m-%d")

        cur.execute("""
            SELECT id, vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog,
                   viaticos, estado, hora_inicio_real, hora_fin_real, tolerancia_minutos
            FROM planeacion_rutas WHERE fecha::text = %s ORDER BY hora_inicio_prog
        """, (f,))
        rutas = cur.fetchall()
        resultado = []

        for r in rutas:
            ruta_id = r[0]
            placa = r[1]
            try:
                empleados = json.loads(r[2]) if r[2] else []
            except:
                empleados = []

            # Obtener ultima marcacion de cada empleado en esta ruta
            marcaciones_empleados = []
            for emp in empleados:
                # Obtener TODAS las marcaciones del dia para este empleado
                cur.execute("""
                    SELECT tipo_marca, hora, latitud, longitud, es_extra, minutos_extra
                    FROM asistencia
                    WHERE usuario = %s AND fecha::text = %s
                    AND vehiculo_placa = %s
                    ORDER BY id ASC
                """, (emp, f, placa))
                todas_marcas = cur.fetchall()
                ultima = todas_marcas[-1] if todas_marcas else None

                # Calcular tiempo en ruta desde primer INGRESO
                tiempo_ruta = None
                primera = todas_marcas[0] if todas_marcas else None
                if primera:
                    try:
                        h_parts = primera[1].split(":")
                        h_min = int(h_parts[0]) * 60 + int(h_parts[1])
                        ahora_min = datetime.now().hour * 60 + datetime.now().minute
                        tiempo_ruta = ahora_min - h_min
                    except:
                        tiempo_ruta = None

                # Construir historial de marcaciones
                historial = []
                for m in todas_marcas:
                    historial.append({
                        "tipo": m[0],
                        "hora": m[1],
                        "latitud": float(m[2]) if m[2] else None,
                        "longitud": float(m[3]) if m[3] else None,
                        "es_extra": m[4] or False,
                        "minutos_extra": m[5] or 0
                    })

                marcaciones_empleados.append({
                    "nombre": emp,
                    "ultima_marca": ultima[0] if ultima else "SIN MARCAR",
                    "hora_marca": ultima[1] if ultima else None,
                    "latitud": float(ultima[2]) if ultima and ultima[2] else None,
                    "longitud": float(ultima[3]) if ultima and ultima[3] else None,
                    "es_extra": ultima[4] if ultima else False,
                    "minutos_extra": ultima[5] if ultima else 0,
                    "tiempo_en_ruta_min": tiempo_ruta,
                    "historial": historial
                })

            resultado.append({
                "id": ruta_id,
                "placa": placa,
                "empleados": marcaciones_empleados,
                "h_inicio": r[3],
                "h_fin": r[4],
                "viaticos": float(r[5]) if r[5] else 0,
                "estado": r[6] or "programada",
                "tolerancia": r[9] or 15,
                "total_empleados": len(empleados),
                "empleados_activos": sum(1 for e in marcaciones_empleados if e["ultima_marca"] != "SIN MARCAR")
            })

        release_conn(conn)
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            UPDATE usuarios SET
                nombre = %s, documento = %s, empresa = %s,
                salario_base = %s, tasa_extra = %s, rol = %s
            WHERE id = %s
        """, (p.nombre, p.doc, p.empresa,
              float(p.salario or 0), float(p.extra or 0), p.rol, uid))
        conn.commit()
        release_conn(conn)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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


# ==================== GPS TRACKING ====================
@app.post("/gps/ping")
def gps_ping(data: dict):
    """Recibe posicion GPS de un usuario activo cada 5 min"""
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
        # Upsert: una sola fila por usuario por dia (actualiza)
        cur.execute("""
            INSERT INTO gps_tracking (username, nombre, latitud, longitud, precision_m, timestamp, fecha)
            VALUES (%s, %s, %s, %s, %s, NOW(), CURRENT_DATE)
            ON CONFLICT DO NOTHING
        """, (data.get("username"), data.get("nombre"),
              data.get("lat"), data.get("lng"), data.get("precision")))
        # Always update latest position
        cur.execute("""
            UPDATE gps_tracking
            SET latitud=%s, longitud=%s, precision_m=%s, timestamp=NOW()
            WHERE username=%s AND fecha=CURRENT_DATE
        """, (data.get("lat"), data.get("lng"),
              data.get("precision"), data.get("username")))
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
                      WHERE usuario = g.nombre AND fecha = CURRENT_DATE
                      ORDER BY id DESC LIMIT 1), 'SIN MARCAR'
                   ) as ultima_marca,
                   COALESCE(
                     (SELECT hora FROM asistencia
                      WHERE usuario = g.nombre AND fecha = CURRENT_DATE
                      ORDER BY id DESC LIMIT 1), ''
                   ) as ultima_hora
            FROM gps_tracking g
            LEFT JOIN usuarios u ON u.username = g.username
            WHERE g.fecha = CURRENT_DATE
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
    try:
        conn = get_conn(); cur = conn.cursor()
        crear_tablas_servicios(cur, conn)
        conditions = []
        params = []
        if categoria:
            conditions.append("categoria = %s"); params.append(categoria)
        if activo is not None:
            conditions.append("activo = %s"); params.append(activo)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        cur.execute(f"SELECT id,codigo,nombre,categoria,descripcion,tiempo_estimado_min,marca,modelo,foto_url,activo FROM referencias {where} ORDER BY categoria,nombre", params)
        rows = cur.fetchall()
        result = []
        for r in rows:
            cur.execute("SELECT id,nombre,cantidad,unidad,descripcion,orden_display FROM referencia_piezas WHERE referencia_id=%s ORDER BY orden_display,id", (r[0],))
            piezas = [{"id":p[0],"nombre":p[1],"cantidad":p[2],"unidad":p[3],"descripcion":p[4],"orden":p[5]} for p in cur.fetchall()]
            result.append({"id":r[0],"codigo":r[1],"nombre":r[2],"categoria":r[3],"descripcion":r[4],"tiempo_estimado_min":r[5],"marca":r[6],"modelo":r[7],"foto_url":r[8],"activo":r[9],"piezas":piezas,"total_piezas":len(piezas)})
        release_conn(conn)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
    try:
        conn = get_conn(); cur = conn.cursor()
        crear_tablas_servicios(cur, conn)
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
        release_conn(conn)
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
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            SELECT o.*, r.codigo, r.nombre, r.categoria, u.nombre as tecnico
            FROM ordenes_servicio o
            LEFT JOIN referencias r ON r.id=o.referencia_id
            LEFT JOIN usuarios u ON u.id=o.tecnico_id
            WHERE o.id=%s
        """, (oid,))
        o = cur.fetchone()
        if not o: raise HTTPException(status_code=404, detail="Orden no encontrada")
        cur.execute("SELECT * FROM inspeccion_piezas WHERE orden_id=%s ORDER BY id", (oid,))
        inspeccion = cur.fetchall()
        cur.execute("SELECT * FROM novedades_servicio WHERE orden_id=%s ORDER BY id", (oid,))
        novedades = cur.fetchall()
        release_conn(conn)
        return {
            "orden": dict(zip([d[0] for d in cur.description], o)) if False else {
                "id":o[0],"consecutivo":o[1],"estado":o[3],
                "cliente_nombre":o[4],"cliente_direccion":o[5],"cliente_telefono":o[6],
                "num_factura":o[7],"tipo_servicio":o[2],
                "fecha_inicio":str(o[9]) if o[9] else "","fecha_cierre":str(o[10]) if o[10] else "",
                "duracion_min":o[11],"lat_inicio":float(o[12]) if o[12] else None,
                "lng_inicio":float(o[13]) if o[13] else None,
                "observaciones":o[17],"tecnico":o[-1],
                "referencia_codigo":o[-4],"referencia_nombre":o[-3],"referencia_categoria":o[-2]
            },
            "inspeccion": [{"id":i[0],"pieza_id":i[2],"nombre":i[3],"estado":i[4],"novedad":i[6],"accion":i[7]} for i in inspeccion],
            "novedades": [{"id":n[0],"descripcion":n[2],"tipo":n[3],"accion":n[4],"timestamp":str(n[6])} for n in novedades]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
