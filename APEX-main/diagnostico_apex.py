"""
APEX ERP - Script de Diagnostico
Corre este script en la misma carpeta que main_api.py:
    python diagnostico_apex.py

Te mostrara exactamente que hay en la BD y por que falla el flujo.
"""

import os, json
from dotenv import load_dotenv
load_dotenv()

try:
    import psycopg2
except ImportError:
    print("Instalando psycopg2...")
    os.system("pip install psycopg2-binary")
    import psycopg2

# ── Conexion ──────────────────────────────────────────────
def conectar():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASS"),
        port="6543",
        connect_timeout=10
    )

SEP = "=" * 60

def titulo(s):
    print(f"\n{SEP}\n  {s}\n{SEP}")

try:
    conn = conectar()
    cur  = conn.cursor()
    print("OK: Conexion a Supabase exitosa")
except Exception as e:
    print(f"ERROR conexion: {e}")
    exit(1)

# ── 1. USUARIOS ───────────────────────────────────────────
titulo("1. TABLA USUARIOS")
cur.execute("SELECT id, username, nombre, rol FROM usuarios ORDER BY id")
usuarios = cur.fetchall()
print(f"{'ID':<5} {'USERNAME':<20} {'NOMBRE':<25} {'ROL':<10}")
print("-"*60)
for u in usuarios:
    print(f"{str(u[0]):<5} {str(u[1] or 'NULL'):<20} {str(u[2] or 'NULL'):<25} {str(u[3] or ''):<10}")

# ── 2. RUTAS DE HOY ───────────────────────────────────────
titulo("2. RUTAS DE HOY (planeacion_rutas)")
from datetime import datetime
hoy = datetime.now().strftime("%Y-%m-%d")

cur.execute("""
    SELECT id, vehiculo_placa, empleados_json, fecha, hora_inicio_prog, hora_fin_prog
    FROM planeacion_rutas WHERE fecha::text = %s ORDER BY id DESC
""", (hoy,))
rutas = cur.fetchall()
if not rutas:
    print(f"  Sin rutas para {hoy}")
for r in rutas:
    print(f"\n  Ruta ID={r[0]} | Placa={r[1]} | Fecha={r[3]}")
    print(f"  Horario: {r[4]} - {r[5]}")
    print(f"  empleados_json RAW = {r[2]!r}")
    try:
        emp_list = json.loads(r[2]) if r[2] else []
        print(f"  empleados parseados = {emp_list}")
    except Exception as ep:
        print(f"  ERROR parseando JSON: {ep}")

# ── 3. MARCACIONES DE HOY ─────────────────────────────────
titulo("3. MARCACIONES DE HOY (asistencia)")
cur.execute("""
    SELECT id, usuario, tipo_marca, hora, vehiculo_placa, ruta_id, latitud, longitud
    FROM asistencia WHERE fecha::text = %s ORDER BY id
""", (hoy,))
marcas = cur.fetchall()
if not marcas:
    print(f"  Sin marcaciones para {hoy}")
print(f"{'ID':<6} {'USUARIO':<20} {'TIPO':<12} {'HORA':<8} {'PLACA':<10} {'RUTA_ID':<8} {'GPS'}")
print("-"*80)
for m in marcas:
    gps = f"{m[6]},{m[7]}" if m[6] else "SIN GPS"
    print(f"{str(m[0]):<6} {str(m[1] or ''):<20} {str(m[2] or ''):<12} {str(m[3] or ''):<8} {str(m[4] or ''):<10} {str(m[5] or ''):<8} {gps}")

# ── 4. GPS TRACKING ───────────────────────────────────────
titulo("4. GPS TRACKING HOY")
try:
    cur.execute("""
        SELECT username, nombre, latitud, longitud, timestamp
        FROM gps_tracking WHERE fecha = CURRENT_DATE ORDER BY timestamp DESC
    """)
    gps_rows = cur.fetchall()
    if not gps_rows:
        print("  Sin registros GPS para hoy")
    for g in gps_rows:
        print(f"  username={g[0]} | nombre={g[1]} | lat={g[2]} | lng={g[3]} | ts={g[4]}")
except Exception as eg:
    print(f"  ERROR (tabla puede no existir aun): {eg}")

# ── 5. DIAGNOSTICO DE COINCIDENCIAS ───────────────────────
titulo("5. DIAGNOSTICO: iCoinciden los identificadores?")

# Construir mapa de usuarios
cur.execute("SELECT COALESCE(nombre,''), COALESCE(username,'') FROM usuarios")
usr_map = cur.fetchall()
n2u = {r[0].strip().lower(): r[1].strip() for r in usr_map if r[0].strip() and r[1].strip()}
u2n = {r[1].strip().lower(): r[0].strip() for r in usr_map if r[0].strip() and r[1].strip()}

print(f"\n  Mapa nombre->username: {n2u}")
print(f"  Mapa username->nombre: {u2n}")

# Verificar cada ruta vs marcaciones
for r in rutas:
    try:
        emp_list = json.loads(r[2]) if r[2] else []
    except:
        emp_list = []
    print(f"\n  Ruta {r[0]} empleados={emp_list}")
    for emp in emp_list:
        el = emp.strip().lower()
        uname = n2u.get(el) or u2n.get(el) or el
        nname = u2n.get(el) or n2u.get(el) or emp
        print(f"    '{emp}' -> username='{uname}' nombre='{nname}'")
        # Buscar marcaciones
        cur.execute("""
            SELECT usuario, tipo_marca, hora FROM asistencia
            WHERE usuario = ANY(%s) AND fecha::text = %s
        """, ([uname, nname, emp], hoy))
        encontradas = cur.fetchall()
        if encontradas:
            print(f"    Marcaciones encontradas: {encontradas}")
        else:
            print(f"    SIN MARCACIONES - buscando con: {[uname, nname, emp]}")
            # Ver que hay en asistencia
            cur.execute("SELECT DISTINCT usuario FROM asistencia WHERE fecha::text = %s", (hoy,))
            todos = [x[0] for x in cur.fetchall()]
            print(f"    Usuarios en asistencia hoy: {todos}")

conn.close()
print(f"\n{SEP}")
print("  DIAGNOSTICO COMPLETADO")
print(f"  Copia y pega este output para el asistente")
print(SEP)