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
def get_conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASS"),
        port="6543",
        connect_timeout=10
    )

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

class ReferenciaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    costo: Optional[float] = 0
    piezas_json: Optional[str] = "[]"

class OrdenCreate(BaseModel):
    tecnico_id: int
    referencia_id: int
    tiempo_total: Optional[float] = 0
    novedades_json: Optional[str] = "[]"

class PlaneacionCreate(BaseModel):
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
        conn.close()
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
        conn.close()
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
        cur.execute("SELECT nombre, rol, salario_base, id_interno, empresa FROM usuarios ORDER BY nombre")
        rows = cur.fetchall()
        conn.close()
        return [
            {"nombre": r[0], "rol": r[1], "salario_base": r[2], "id_interno": r[3], "empresa": r[4]}
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
        conn.close()
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
        cur.execute("SELECT id, placa, modelo, estado FROM vehiculos ORDER BY placa")
        rows = cur.fetchall()
        conn.close()
        return [{"id": r[0], "placa": r[1], "modelo": r[2], "estado": r[3]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vehiculos")
def crear_vehiculo(v: VehiculoCreate):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO vehiculos (placa, modelo, estado) VALUES (%s, %s, \'disponible\')",
            (v.placa.upper(), v.modelo)
        )
        conn.commit()
        conn.close()
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
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================
# REFERENCIAS
# ============================================================
@app.get("/referencias")
def get_referencias():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id, nombre_referencia, descripcion, costo_mano_obra, piezas_json FROM maestro_referencias ORDER BY nombre_referencia")
        rows = cur.fetchall()
        conn.close()
        return [
            {"id": r[0], "nombre_referencia": r[1], "descripcion": r[2], "costo_mano_obra": r[3], "piezas_json": r[4]}
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/referencias")
def crear_referencia(r: ReferenciaCreate):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO maestro_referencias (nombre_referencia, descripcion, costo_mano_obra, piezas_json)
            VALUES (%s, %s, %s, %s)
        """, (r.nombre, r.descripcion, r.costo, r.piezas_json))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================
# ORDENES DE SERVICIO
# ============================================================
@app.get("/ordenes")
def get_ordenes():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT o.id, u.nombre, m.nombre_referencia, o.fecha_creacion,
                   o.estado, o.tiempo_total, o.novedades_json
            FROM ordenes_servicio o
            LEFT JOIN usuarios u ON o.tecnico_id = u.id
            LEFT JOIN maestro_referencias m ON o.referencia_id = m.id
            ORDER BY o.id DESC LIMIT 50
        """)
        rows = cur.fetchall()
        conn.close()
        return [
            {"id": r[0], "tecnico": r[1], "equipo": r[2], "fecha": str(r[3]),
             "estado": r[4], "tiempo": r[5], "novedades": r[6]}
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ordenes")
def crear_orden(o: OrdenCreate):
    try:
        conn = get_conn()
        cur = conn.cursor()
        fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cur.execute("""
            INSERT INTO ordenes_servicio
            (tecnico_id, referencia_id, fecha_creacion, estado, tiempo_total, novedades_json)
            VALUES (%s, %s, %s, \'cerrado\', %s, %s)
            RETURNING id
        """, (o.tecnico_id, o.referencia_id, fecha, o.tiempo_total, o.novedades_json))
        orden_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {"ok": True, "orden_id": orden_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================
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
        conn.close()
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
        conn.close()
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
            SELECT COUNT(*) FROM ordenes_servicio
            WHERE novedades_json != \'[]\'
            AND fecha_creacion::date = %s::date
        """, (fecha_hoy,))
        novedades_hoy = cur.fetchone()[0]

        conn.close()
        return {
            "servicios_hoy": servicios_hoy,
            "personal_activo": total_personal,
            "vehiculos_en_ruta": vehiculos_ruta,
            "novedades_hoy": novedades_hoy,
        }
    except Exception as e:
        return {"servicios_hoy": 0, "personal_activo": 0, "vehiculos_en_ruta": 0, "novedades_hoy": 0}


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

        # Tabla maestro de tipos de novedad
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()

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
        conn.close()
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

        conn.close()
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
        conn.close()

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
        conn.close()

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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main_api:app", host="0.0.0.0", port=port, reload=False)