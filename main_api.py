import os
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
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

@app.post("/rutas")
def crear_ruta(p: PlaneacionCreate):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO planeacion_rutas (fecha, vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog)
            VALUES (%s, %s, %s, %s, %s)
        """, (p.fecha, p.placa, json.dumps(p.empleados), p.h_inicio, p.h_fin))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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

@app.post("/asistencia")
def marcar_asistencia(a: AsistenciaCreate):
    try:
        hora = datetime.now().strftime("%H:%M")
        fecha = datetime.now().strftime("%Y-%m-%d")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO asistencia (usuario, vehiculo_placa, tipo_marca, hora, fecha)
            VALUES (%s, %s, %s, %s, %s)
        """, (a.usuario, a.vehiculo_placa, a.tipo_marca, hora, fecha))
        conn.commit()
        conn.close()
        return {"ok": True, "hora": hora}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main_api:app", host="0.0.0.0", port=port, reload=False)