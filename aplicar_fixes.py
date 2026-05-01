"""
APEX ERP - aplicar_fixes.py
Ejecutar desde C:\\Users\\mq1\\Documents\\Proyectos\\APEX\\

    python aplicar_fixes.py

Modifica main_api.py y Horarios.jsx directamente.
"""
import os, sys, ast, shutil

BASE = os.path.dirname(os.path.abspath(__file__))
API  = os.path.join(BASE, "main_api.py")
HOR  = os.path.join(BASE, "src", "components", "Horarios.jsx")

# Intentar rutas alternativas para Horarios
if not os.path.exists(HOR):
    for alt in ["Horarios.jsx", "frontend/src/components/Horarios.jsx",
                "frontend/Horarios.jsx", "src/Horarios.jsx"]:
        p = os.path.join(BASE, alt)
        if os.path.exists(p):
            HOR = p; break

print(f"main_api.py : {API} {'OK' if os.path.exists(API) else 'NO ENCONTRADO'}")
print(f"Horarios.jsx: {HOR} {'OK' if os.path.exists(HOR) else 'NO ENCONTRADO'}")

errors = []
if not os.path.exists(API): errors.append(f"No existe {API}")
if errors:
    for e in errors: print(f"ERROR: {e}")
    sys.exit(1)

# ══════════════════════════════════════════════════════════════
# PARCHEAR main_api.py
# ══════════════════════════════════════════════════════════════
code = open(API, encoding="utf-8").read()
fixes = []

# FIX 1: gps/ping
idx = code.find('@app.post("/gps/ping")')
end = code.find('\n@app.', idx + 10)
if idx != -1 and "rowcount" not in code[idx:end]:
    code = code[:idx] + '''@app.post("/gps/ping")
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
            timestamp TIMESTAMPTZ DEFAULT NOW(), fecha TEXT DEFAULT CURRENT_DATE::text)""")
        conn.commit()
        cur.execute("""UPDATE gps_tracking
            SET latitud=%s, longitud=%s, precision_m=%s, nombre=%s, timestamp=NOW()
            WHERE username=%s AND fecha=CURRENT_DATE::text""", (lat, lng, prec, nombre, uname))
        if cur.rowcount == 0:
            cur.execute("""INSERT INTO gps_tracking
                (username, nombre, latitud, longitud, precision_m, timestamp, fecha)
                VALUES (%s,%s,%s,%s,%s,NOW(),CURRENT_DATE::text)""", (uname, nombre, lat, lng, prec))
        conn.commit(); release_conn(conn)
        return {"ok": True}
    except Exception as e:
        try: conn.rollback(); release_conn(conn)
        except: pass
        raise HTTPException(status_code=400, detail=str(e))

''' + code[end:]
    fixes.append("OK gps/ping (UPDATE+INSERT sin DO $$)")
else:
    fixes.append("SKIP gps/ping")

# FIX 2: gps/activos
idx = code.find('def gps_activos():')
end = code.find('\n@app.', idx + 10)
if idx != -1 and "DISTINCT ON" not in code[idx:end]:
    code = code[:idx] + '''def gps_activos():
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS gps_tracking (
            id SERIAL PRIMARY KEY, username TEXT NOT NULL, nombre TEXT,
            latitud NUMERIC, longitud NUMERIC, precision_m NUMERIC,
            timestamp TIMESTAMPTZ DEFAULT NOW(), fecha TEXT DEFAULT CURRENT_DATE::text)""")
        conn.commit()
        cur.execute("""DELETE FROM gps_tracking WHERE id NOT IN (
            SELECT DISTINCT ON (username, fecha) id FROM gps_tracking
            ORDER BY username, fecha, timestamp DESC)""")
        conn.commit()
        cur.execute("""
            SELECT DISTINCT ON (g.username)
                   g.username, COALESCE(u.nombre, g.nombre, g.username),
                   g.latitud, g.longitud, g.precision_m, g.timestamp, u.rol,
                   COALESCE((SELECT tipo_marca FROM asistencia
                      WHERE usuario = ANY(ARRAY[g.username, COALESCE(u.nombre, g.nombre)])
                        AND fecha::text = CURRENT_DATE::text
                      ORDER BY id DESC LIMIT 1), 'SIN MARCAR'),
                   COALESCE((SELECT hora FROM asistencia
                      WHERE usuario = ANY(ARRAY[g.username, COALESCE(u.nombre, g.nombre)])
                        AND fecha::text = CURRENT_DATE::text
                      ORDER BY id DESC LIMIT 1), '')
            FROM gps_tracking g
            LEFT JOIN usuarios u ON u.username = g.username
            WHERE g.fecha = CURRENT_DATE::text
            ORDER BY g.username, g.timestamp DESC
        """)
        rows = cur.fetchall()
        release_conn(conn)
        return [{"username": r[0], "nombre": r[1],
            "lat": float(r[2]) if r[2] else None, "lng": float(r[3]) if r[3] else None,
            "precision": float(r[4]) if r[4] else None,
            "timestamp": r[5].isoformat() if r[5] else None,
            "rol": r[6], "ultima_marca": r[7], "ultima_hora": r[8]
        } for r in rows if r[2] and r[3]]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

''' + code[end:]
    fixes.append("OK gps/activos (DISTINCT ON + ANY)")
else:
    fixes.append("SKIP gps/activos")

# FIX 3: marcaciones nombre_real
if "nombre_real" not in code:
    old = '''        # Insertar marcacion
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
    new = '''        cur.execute("SELECT COALESCE(nombre,username) FROM usuarios WHERE username=%s OR nombre=%s LIMIT 1", (m.usuario, m.usuario))
        _ur = cur.fetchone()
        nombre_real = _ur[0] if _ur else m.usuario
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
    if old in code:
        code = code.replace(old, new)
        fixes.append("OK marcaciones (guarda nombre real)")
    else:
        fixes.append("SKIP marcaciones (estructura diferente)")
else:
    fixes.append("SKIP marcaciones (ya parchado)")

# FIX 4: MarcacionCreate vehiculo_placa opcional
old4 = "    vehiculo_placa: str\n    tipo_marca: str  # INGRESO | ALMUERZO | RETORNO | CIERRE"
new4 = "    vehiculo_placa: Optional[str] = \"\"\n    tipo_marca: str"
if old4 in code:
    code = code.replace(old4, new4)
    fixes.append("OK MarcacionCreate (vehiculo_placa opcional)")
else:
    fixes.append("SKIP MarcacionCreate")

# FIX 5: monitor_rutas
if "ANY(%s)" not in code:
    old5 = '''            # Obtener ultima marcacion de cada empleado en esta ruta
            marcaciones_empleados = []
            for emp in empleados:
                # Obtener TODAS las marcaciones del dia para este empleado
            # Obtener TODAS las marcaciones del dia para este empleado en esta ruta
                cur.execute("""
                    SELECT tipo_marca, hora, latitud, longitud, es_extra, minutos_extra
                    FROM asistencia
                    WHERE usuario = %s AND fecha::text = %s
                      AND (ruta_id = %s OR vehiculo_placa = %s)
                    ORDER BY id ASC
                """, (emp, f, ruta_id, placa))'''
    new5 = '''            cur.execute("SELECT COALESCE(nombre,''),COALESCE(username,'') FROM usuarios WHERE username IS NOT NULL AND username!=''")
            _usr=cur.fetchall(); _n2u={x[0].strip().lower():x[1].strip() for x in _usr if x[0].strip()}; _u2n={x[1].strip().lower():x[0].strip() for x in _usr if x[1].strip()}
            marcaciones_empleados = []
            for emp in empleados:
                el=(emp or "").strip().lower(); emp_username=_n2u.get(el) or _u2n.get(el) or el; emp_nombre=_u2n.get(el) or _n2u.get(el) or emp
                cur.execute("""
                    SELECT tipo_marca, hora, latitud, longitud, es_extra, minutos_extra
                    FROM asistencia WHERE usuario = ANY(%s) AND fecha::text = %s
                    ORDER BY id ASC
                """, ([emp_username, emp_nombre, emp], f))'''
    if old5 in code:
        code = code.replace(old5, new5)
        fixes.append("OK monitor (busca por nombre Y username)")
    else:
        fixes.append("SKIP monitor (estructura diferente)")
else:
    fixes.append("SKIP monitor (ya parchado)")

old6 = '                marcaciones_empleados.append({\n                    "nombre": emp,\n                    "ultima_marca": ultima[0] if ultima else "SIN MARCAR",'
new6 = '                marcaciones_empleados.append({\n                    "nombre": emp_nombre,\n                    "username": emp_username,\n                    "ultima_marca": ultima[0] if ultima else "SIN MARCAR",'
if old6 in code:
    code = code.replace(old6, new6)
    fixes.append("OK monitor append (nombre+username)")

# FIX 6: rutas fecha::text
old7 = "FROM planeacion_rutas WHERE fecha = %s ORDER BY id DESC"
new7 = "FROM planeacion_rutas WHERE fecha::text = %s ORDER BY id DESC"
if old7 in code:
    code = code.replace(old7, new7)
    fixes.append("OK /rutas fecha::text")

# Verificar y guardar
try:
    ast.parse(code)
except SyntaxError as e:
    print(f"ERROR SINTAXIS main_api: {e}"); sys.exit(1)

shutil.copy(API, API + ".backup")
open(API, "w", encoding="utf-8").write(code)
print(f"\nmain_api.py actualizado. Backup en main_api.py.backup")
for f in fixes: print(f"  {f}")

# ══════════════════════════════════════════════════════════════
# PARCHEAR Horarios.jsx
# ══════════════════════════════════════════════════════════════
if not os.path.exists(HOR):
    print(f"\nHorarios.jsx no encontrado en {HOR}")
    print("Copia manualmente Horarios.jsx al directorio correcto.")
else:
    hor = open(HOR, encoding="utf-8").read()
    hfixes = []

    old_a = '''const cargarRutasUsuario = () => {
    if (!nombreUsuario) return;
    const hoy = new Date().toISOString().split("T")[0];
    fetch(API_URL + "/rutas?fecha=" + hoy)
      .then(r=>r.json())
      .then(d => {
        const todas = Array.isArray(d) ? d : [];
        const nombreUser = nombreUsuario.toLowerCase();
        const mias = todas.filter(r => {
          const equipo = r.equipo || r.empleados || [];
          return equipo.some(e => (e || "").trim().toLowerCase() === nombreUser);
        });
        setRutasUsuario(mias);
        if (mias.length === 1) {
          setMarcForm(f => ({
            ...f,
            vehiculo_placa: mias[0].placa || "",
            ruta_id: mias[0].id || "",
          }));
        } else if (mias.length === 0) {
          setMarcForm(f => ({ ...f, vehiculo_placa: "", ruta_id: "" }));
        }
      })
      .catch(()=>{});
  }'''
    new_a = '''const cargarRutasUsuario = () => {
    const uname = (user?.username || "").trim().toLowerCase();
    const nname = (user?.nombre   || "").trim().toLowerCase();
    if (!uname && !nname) return;
    const hoy = new Date().toISOString().split("T")[0];
    fetch(API_URL + "/rutas?fecha=" + hoy)
      .then(r=>r.json())
      .then(d => {
        const todas = Array.isArray(d) ? d : [];
        const mias = todas.filter(r => {
          const enNombre   = (r.equipo      || []).some(e => { const el=(e||"").trim().toLowerCase(); return el===uname||el===nname; });
          const enUsername = (r.equipo_u    || []).some(e => { const el=(e||"").trim().toLowerCase(); return el===uname||el===nname; });
          const enFull     = (r.equipo_full || []).some(e =>
            (e.username||"").toLowerCase()===uname || (e.nombre||"").toLowerCase()===nname ||
            (e.username||"").toLowerCase()===nname || (e.nombre||"").toLowerCase()===uname
          );
          return enNombre || enUsername || enFull;
        });
        setRutasUsuario(mias);
        if (mias.length === 1) {
          setMarcForm(f => ({ ...f, vehiculo_placa: mias[0].placa || "", ruta_id: mias[0].id || null }));
        } else if (mias.length === 0) {
          setMarcForm(f => ({ ...f, vehiculo_placa: "", ruta_id: null }));
        }
      })
      .catch(()=>{});
  }'''
    if old_a in hor:
        hor = hor.replace(old_a, new_a); hfixes.append("OK cargarRutasUsuario")
    else:
        hfixes.append("SKIP cargarRutasUsuario")

    old_b = '''    const payload = {
      ...marcForm,
      tipo_marca: tipo,
      latitud: gps.lat,
      longitud: gps.lon,
    };'''
    new_b = '''    const payload = {
      usuario:      marcForm.usuario,
      vehiculo_placa: marcForm.vehiculo_placa || "",
      tipo_marca:   tipo,
      latitud:      gps.lat,
      longitud:     gps.lon,
      ruta_id:      marcForm.ruta_id ? parseInt(marcForm.ruta_id) : null,
      novedad_tipo_id:    marcForm.novedad_tipo_id || null,
      novedad_descripcion: marcForm.novedad_descripcion || null,
    };'''
    if old_b in hor:
        hor = hor.replace(old_b, new_b); hfixes.append("OK payload limpio")
    else:
        hfixes.append("SKIP payload")

    if '    ruta_id: "",' in hor:
        hor = hor.replace('    ruta_id: "",', '    ruta_id: null,', 1)
        hfixes.append("OK ruta_id null")

    old_d = '          username: user?.username || user?.user || marcForm.usuario,\n          nombre: marcForm.usuario,'
    new_d = '          username: (user?.username || "").trim(),\n          nombre:   (user?.nombre || user?.username || "").trim(),'
    if old_d in hor:
        hor = hor.replace(old_d, new_d); hfixes.append("OK GPS ping username")

    shutil.copy(HOR, HOR + ".backup")
    open(HOR, "w", encoding="utf-8").write(hor)
    print(f"\nHorarios.jsx actualizado.")
    for f in hfixes: print(f"  {f}")

print("\n=== LISTO ===")
print("Reinicia el servidor: Ctrl+C y luego:")
print("  uvicorn main_api:app --reload --host 0.0.0.0 --port 8000")
