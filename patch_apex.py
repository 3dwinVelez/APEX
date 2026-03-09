"""
APEX ERP - Patch Script
Ejecutar desde la carpeta del proyecto:
    python patch_apex.py

Modifica main_api.py directamente con todos los fixes.
"""
import re, sys, os

target = os.path.join(os.path.dirname(__file__), "main_api.py")
if not os.path.exists(target):
    print(f"ERROR: No encontre {target}")
    sys.exit(1)

code = open(target, encoding="utf-8").read()
original = code
patches = []

# ============================================================
# PATCH 1: gps/activos - DISTINCT ON + limpiar duplicados
# ============================================================
old1_marker = 'def gps_activos():'
idx = code.find(old1_marker)
if idx == -1:
    patches.append("SKIP gps_activos (no encontrado)")
else:
    end = code.find("\n@app.", idx + 10)
    new_ga = '''def gps_activos():
    """Retorna ultima posicion de cada usuario activo hoy"""
    try:
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS gps_tracking (
                id SERIAL PRIMARY KEY, username TEXT NOT NULL, nombre TEXT,
                latitud NUMERIC, longitud NUMERIC, precision_m NUMERIC,
                timestamp TIMESTAMPTZ DEFAULT NOW(), fecha DATE DEFAULT CURRENT_DATE)
        """)
        conn.commit()
        # Limpiar duplicados - dejar solo el mas reciente por usuario/dia
        cur.execute("""
            DELETE FROM gps_tracking
            WHERE id NOT IN (
                SELECT DISTINCT ON (username, fecha) id
                FROM gps_tracking
                ORDER BY username, fecha, timestamp DESC
            )
        """)
        conn.commit()
        cur.execute("""
            SELECT DISTINCT ON (g.username)
                   g.username,
                   COALESCE(u.nombre, g.nombre, g.username) as nombre,
                   g.latitud, g.longitud, g.precision_m, g.timestamp, u.rol,
                   COALESCE(
                     (SELECT tipo_marca FROM asistencia
                      WHERE usuario = ANY(ARRAY[g.username, COALESCE(u.nombre, g.nombre)])
                        AND fecha = CURRENT_DATE
                      ORDER BY id DESC LIMIT 1), 'SIN MARCAR'
                   ) as ultima_marca,
                   COALESCE(
                     (SELECT hora FROM asistencia
                      WHERE usuario = ANY(ARRAY[g.username, COALESCE(u.nombre, g.nombre)])
                        AND fecha = CURRENT_DATE
                      ORDER BY id DESC LIMIT 1), ''
                   ) as ultima_hora
            FROM gps_tracking g
            LEFT JOIN usuarios u ON u.username = g.username
            WHERE g.fecha = CURRENT_DATE
            ORDER BY g.username, g.timestamp DESC
        """)
        rows = cur.fetchall()
        release_conn(conn)
        return [{"username": r[0], "nombre": r[1],
            "lat":       float(r[2]) if r[2] else None,
            "lng":       float(r[3]) if r[3] else None,
            "precision": float(r[4]) if r[4] else None,
            "timestamp": r[5].isoformat() if r[5] else None,
            "rol": r[6], "ultima_marca": r[7], "ultima_hora": r[8]
        } for r in rows if r[2] and r[3]]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

'''
    code = code[:idx] + new_ga + code[end+1:]
    patches.append("OK gps_activos con DISTINCT ON")

# ============================================================
# PATCH 2: gps/ping - UPDATE+INSERT sin DO $$
# ============================================================
idx2 = code.find('@app.post("/gps/ping")')
end2 = code.find("\n@app.", idx2 + 10)
new_ping = '''@app.post("/gps/ping")
def gps_ping(data: dict):
    uname  = (data.get("username") or "").strip()
    nombre = (data.get("nombre") or data.get("username") or "").strip()
    lat, lng, prec = data.get("lat"), data.get("lng"), data.get("precision")
    if not uname or lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Faltan: username, lat, lng")
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS gps_tracking (
            id SERIAL PRIMARY KEY, username TEXT NOT NULL, nombre TEXT,
            latitud NUMERIC, longitud NUMERIC, precision_m NUMERIC,
            timestamp TIMESTAMPTZ DEFAULT NOW(), fecha DATE DEFAULT CURRENT_DATE)""")
        conn.commit()
        cur.execute("""UPDATE gps_tracking
            SET latitud=%s, longitud=%s, precision_m=%s, nombre=%s, timestamp=NOW()
            WHERE username=%s AND fecha=CURRENT_DATE""", (lat, lng, prec, nombre, uname))
        if cur.rowcount == 0:
            cur.execute("""INSERT INTO gps_tracking
                (username, nombre, latitud, longitud, precision_m, timestamp, fecha)
                VALUES (%s,%s,%s,%s,%s,NOW(),CURRENT_DATE)""", (uname, nombre, lat, lng, prec))
        conn.commit(); release_conn(conn)
        return {"ok": True}
    except Exception as e:
        try: conn.rollback(); release_conn(conn)
        except: pass
        raise HTTPException(status_code=400, detail=str(e))

'''
if idx2 != -1:
    code = code[:idx2] + new_ping + code[end2+1:]
    patches.append("OK gps_ping sin DO $$")

# ============================================================
# PATCH 3: POST /marcaciones - guardar nombre real
# ============================================================
old3 = '''        # Insertar marcacion
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
        ))'''
new3 = '''        # Resolver nombre real (asistencia.usuario debe coincidir con empleados_json)
        cur.execute(
            "SELECT COALESCE(nombre, username) FROM usuarios WHERE username=%s OR nombre=%s LIMIT 1",
            (m.usuario, m.usuario)
        )
        _u = cur.fetchone()
        nombre_real = _u[0] if _u else m.usuario

        # Insertar marcacion
        cur.execute("""
            INSERT INTO asistencia
            (usuario, vehiculo_placa, tipo_marca, hora, fecha, latitud, longitud,
             novedad_tipo_id, novedad_descripcion, es_extra, minutos_extra, ruta_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            nombre_real, m.vehiculo_placa or "", m.tipo_marca, hora_actual, fecha_actual,
            m.latitud, m.longitud, m.novedad_tipo_id, m.novedad_descripcion,
            es_extra, minutos_extra, m.ruta_id
        ))'''
if old3 in code:
    code = code.replace(old3, new3)
    patches.append("OK marcaciones guarda nombre_real")
else:
    patches.append("SKIP marcaciones (ya patcheado o diferente)")

# ============================================================
# PATCH 4: GET /rutas - fecha::text + equipo_u
# ============================================================
old4 = "FROM planeacion_rutas WHERE fecha = %s ORDER BY id DESC"
new4 = "FROM planeacion_rutas WHERE fecha::text = %s ORDER BY id DESC"
if old4 in code:
    code = code.replace(old4, new4)
    patches.append("OK GET /rutas fecha::text")
else:
    patches.append("SKIP GET /rutas (ya ok)")

# ============================================================
# PATCH 5: GET /monitor/rutas - busca por username Y nombre
# ============================================================
old5 = '''                cur.execute("""
                    SELECT tipo_marca, hora, latitud, longitud, es_extra, minutos_extra
                    FROM asistencia
                    WHERE usuario = %s AND fecha::text = %s
                    AND vehiculo_placa = %s
                    ORDER BY id ASC
                """, (emp, f, placa))'''
new5 = '''                # Resolver username y nombre del empleado
                _el = (emp or "").strip().lower()
                cur.execute("SELECT COALESCE(nombre,\'\'), COALESCE(username,\'\') FROM usuarios WHERE LOWER(nombre)=%s OR LOWER(username)=%s LIMIT 1", (_el, _el))
                _ur = cur.fetchone()
                _eu = (_ur[1] if _ur else emp).strip() if _ur else emp
                _en = (_ur[0] if _ur else emp).strip() if _ur else emp
                cur.execute("""
                    SELECT tipo_marca, hora, latitud, longitud, es_extra, minutos_extra
                    FROM asistencia
                    WHERE usuario = ANY(%s) AND fecha::text = %s
                    ORDER BY id ASC
                """, ([_eu, _en, emp], f))'''
if old5 in code:
    code = code.replace(old5, new5)
    patches.append("OK monitor busca por username Y nombre")
else:
    # intentar variante
    old5b = '''                cur.execute("""
                    SELECT tipo_marca, hora, latitud, longitud, es_extra, minutos_extra
                    FROM asistencia
                    WHERE usuario = %s AND fecha::text = %s
                      AND (ruta_id = %s OR vehiculo_placa = %s)
                    ORDER BY id ASC
                """, (emp, f, ruta_id, placa))'''
    if old5b in code:
        code = code.replace(old5b, new5)
        patches.append("OK monitor busca por username Y nombre (variante b)")
    else:
        patches.append("SKIP monitor (revisar manualmente)")

# ============================================================
# VERIFICAR Y GUARDAR
# ============================================================
import ast
try:
    ast.parse(code)
    syntax_ok = True
except SyntaxError as e:
    syntax_ok = False
    patches.append(f"ERROR SINTAXIS: {e}")

if syntax_ok and code != original:
    # Backup
    import shutil
    shutil.copy(target, target + ".backup")
    open(target, "w", encoding="utf-8").write(code)
    print(f"Backup guardado en {target}.backup")
    print(f"main_api.py actualizado exitosamente")
elif not syntax_ok:
    print("ERROR: No se guardaron cambios por error de sintaxis")
else:
    print("No se requirieron cambios")

print("\nPatches aplicados:")
for p in patches:
    print(f"  {p}")
