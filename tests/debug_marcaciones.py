# debug_marcacion.py
from data.db_manager import DBManager
from datetime import datetime
import json

db = DBManager()
hoy = datetime.now().strftime("%Y-%m-%d")
usuario = "Administrador"  # El usuario que está en sesión

print("="*60)
print(f"🔍 DEBUG DE MARCACIÓN - Usuario: '{usuario}' - Fecha: {hoy}")
print("="*60)

# 1. Ver TODOS los planes de hoy
print("\n1. PLANES DE HOY:")
with db.conectar() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT vehiculo_placa, empleados_json FROM planeacion_rutas WHERE fecha = ?", (hoy,))
    planes = cursor.fetchall()
    
    if planes:
        for p in planes:
            print(f"\n   📍 Placa: {p[0]}")
            print(f"      JSON: {p[1]}")
            try:
                empleados = json.loads(p[1])
                print(f"      Empleados: {empleados}")
                
                # Verificar si el usuario está en la lista
                if usuario in empleados:
                    print(f"      ✅ '{usuario}' SÍ está en esta ruta")
                else:
                    print(f"      ❌ '{usuario}' NO está en esta ruta")
                    
                    # Mostrar comparación exacta
                    for emp in empleados:
                        print(f"         Comparando: '{usuario}' vs '{emp}' = {usuario == emp}")
                        
            except Exception as e:
                print(f"      ❌ Error: {e}")
    else:
        print("   ❌ No hay planes para hoy")

# 2. Probar la función directamente
print("\n2. PROBANDO FUNCIÓN obtener_planes_empleado:")
resultado = db.obtener_planes_empleado(usuario)
print(f"   Resultado: {resultado}")

# 3. Ver si el usuario existe en la tabla usuarios
print("\n3. VERIFICANDO USUARIO EN BASE:")
with db.conectar() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT nombre, username FROM usuarios WHERE nombre = ? OR username = ?", (usuario, usuario))
    user_data = cursor.fetchone()
    if user_data:
        print(f"   ✅ Usuario encontrado: {user_data[0]} (username: {user_data[1]})")
    else:
        print(f"   ❌ No se encontró usuario '{usuario}'")

# 4. Ver TODAS las rutas (por si el problema es la fecha)
print("\n4. ÚLTIMAS 5 RUTAS EN BASE:")
with db.conectar() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT fecha, vehiculo_placa, empleados_json FROM planeacion_rutas ORDER BY fecha DESC LIMIT 5")
    todas = cursor.fetchall()
    for t in todas:
        print(f"   {t[0]} - {t[1]} - {t[2]}")