
# diagnosticar.py
"""
🔍 DIAGNÓSTICO COMPLETO - APEX ERP
Ejecutar para ver exactamente qué datos hay en la base
"""

import sys
import os
import json
from datetime import datetime

ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ruta_raiz)
from data.db_manager import DBManager

db = DBManager()
print("="*70)
print("🔍 DIAGNÓSTICO COMPLETO DEL SISTEMA")
print("="*70)

# 1. USUARIOS
print("\n👥 USUARIOS REGISTRADOS:")
with db.conectar() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, username, rol FROM usuarios")
    usuarios = cursor.fetchall()
    for u in usuarios:
        print(f"   ID: {u[0]}, Nombre: '{u[1]}', Username: '{u[2]}', Rol: {u[3]}")

# 2. VEHÍCULOS
print("\n🚛 VEHÍCULOS:")
with db.conectar() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT id, placa, modelo FROM vehiculos")
    vehiculos = cursor.fetchall()
    for v in vehiculos:
        print(f"   ID: {v[0]}, Placa: '{v[1]}', Modelo: {v[2]}")

# 3. PLANES DE RUTA (TODOS)
print("\n📅 PLANES DE RUTA (TODOS):")
with db.conectar() as conn:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, fecha, vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog 
        FROM planeacion_rutas 
        ORDER BY fecha DESC
        LIMIT 10
    """)
    planes = cursor.fetchall()
    for p in planes:
        print(f"   ID: {p[0]}")
        print(f"      Fecha: {p[1]}")
        print(f"      Placa: '{p[2]}'")
        print(f"      Empleados: {p[3]}")
        print(f"      Horario: {p[4]} - {p[5]}")

# 4. PLANES PARA HOY
hoy = datetime.now().strftime("%Y-%m-%d")
print(f"\n📅 PLANES PARA HOY ({hoy}):")
with db.conectar() as conn:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT vehiculo_placa, empleados_json 
        FROM planeacion_rutas 
        WHERE fecha = ?
    """, (hoy,))
    planes_hoy = cursor.fetchall()
    if planes_hoy:
        for ph in planes_hoy:
            print(f"   Placa: {ph[0]}, Empleados: {ph[1]}")
    else:
        print("   ❌ NO HAY PLANES PARA HOY")

# 5. ASISTENCIAS HOY
print(f"\n⏱️ ASISTENCIAS HOY ({hoy}):")
with db.conectar() as conn:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT usuario, vehiculo_placa, tipo_marca, hora 
        FROM asistencia 
        WHERE fecha = ?
        ORDER BY usuario, hora
    """, (hoy,))
    asistencias = cursor.fetchall()
    if asistencias:
        for a in asistencias:
            print(f"   Usuario: {a[0]}, Vehículo: {a[1]}, {a[2]}: {a[3]}")
    else:
        print("   ❌ NO HAY ASISTENCIAS HOY")

# 6. PROBAR FUNCIÓN ESPECÍFICA
print("\n🎯 PROBANDO FUNCIÓN obtener_planes_empleado('Edwin'):")
planes_edwin = db.obtener_planes_empleado("Edwin")
print(f"   Resultado: {planes_edwin}")

print("\n🎯 PROBANDO FUNCIÓN obtener_marcas_por_vehiculo('Edwin', 'PRB-001'):")
if vehiculos:
    placa_prueba = vehiculos[0][1]
    marcas = db.obtener_marcas_por_vehiculo("Edwin", placa_prueba)
    print(f"   Marcas: {marcas}")

print("\n" + "="*70)




# ver_usuarios.py
from data.db_manager import DBManager

db = DBManager()
with db.conectar() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT nombre, rol FROM usuarios")
    usuarios = cursor.fetchall()
    
    print("👥 USUARIOS EN BASE:")
    for u in usuarios:
        print(f"   - {u[0]} ({u[1]})")