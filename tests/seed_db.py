# poblar_base_funcional.py
"""
🌱🌱🌱 POBLACIÓN MASIVA - VERSIÓN FUNCIONAL
Ejecutar con: python tests/poblar_base_funcional.py
"""

import sys
import os
import json
import random
import time
import sqlite3
from datetime import datetime, timedelta

# ============================================================
# CONFIGURACIÓN INICIAL
# ============================================================
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ruta_raiz)

# ============================================================
# FUNCIÓN PARA ELIMINAR BASE (FUNCIONA SIEMPRE)
# ============================================================
def eliminar_base_segura():
    """Elimina la base de datos incluso si está en uso"""
    db_path = os.path.join(ruta_raiz, "data", "apex.db")
    
    if not os.path.exists(db_path):
        print("📂 Base no existe - creando nueva")
        return True
    
    print(f"\n🔍 Intentando eliminar: {db_path}")
    
    # Método 1: Intento normal
    try:
        os.remove(db_path)
        print("✅ Base eliminada")
        time.sleep(1)
        return True
    except PermissionError:
        print("⚠️ Base bloqueada - usando método alternativo...")
    
    # Método 2: Renombrar y luego borrar
    try:
        temp_path = db_path + ".temp"
        os.rename(db_path, temp_path)
        time.sleep(1)
        os.remove(temp_path)
        print("✅ Base eliminada (rename trick)")
        return True
    except:
        pass
    
    # Método 3: Comando del sistema (Windows)
    try:
        os.system(f'del /F /Q "{db_path}" 2>nul')
        if not os.path.exists(db_path):
            print("✅ Base eliminada (cmd)")
            return True
    except:
        pass
    
    # Si nada funciona, preguntar
    print("\n❌ No se pudo eliminar automáticamente")
    respuesta = input("¿Quieres CONTINUAR y sobrescribir datos? (s/n): ").lower()
    return respuesta == 's'

# ============================================================
# IMPORTAR DBManager (después de asegurar la base)
# ============================================================
from data.db_manager import DBManager

# ============================================================
# CONFIGURACIÓN DE VOLUMEN
# ============================================================
VOLUMEN = "MEDIO"
FECHA_INICIO = datetime(2025, 1, 1)
FECHA_FIN = datetime.now()  # Hasta hoy

CONFIG = {
    "BASICO": {"empleados": 20, "vehiculos": 10, "referencias": 20, "dias": 30},
    "MEDIO": {"empleados": 50, "vehiculos": 25, "referencias": 50, "dias": 90},
    "ALTO": {"empleados": 100, "vehiculos": 50, "referencias": 100, "dias": 180},
    "ESTRES": {"empleados": 500, "vehiculos": 100, "referencias": 200, "dias": 365}
}

# ============================================================
# DATOS BASE
# ============================================================
NOMBRES = ["Carlos", "Juan", "Andrés", "Luis", "Diego", "Mateo", "Ana", "María", "Laura", "Camila"]
APELLIDOS = ["González", "Rodríguez", "Gómez", "Fernández", "López", "Martínez", "Pérez", "García"]
PLACAS_BASE = ["NPR", "FRR", "NHR", "DMAX", "HINO", "NKX", "MTY", "TRK", "VLV", "SCR"]
MODELOS = ["Isuzu NPR", "Chevrolet FRR", "Chevrolet NHR", "D-Max", "Hino 300", "Jac 1040"]
EMPRESAS = ["APEX LOGÍSTICA", "SCJ SOLUCIONES", "TRANSPORTES RÁPIDOS"]

# ============================================================
# GENERADOR DE DATOS
# ============================================================
class GeneradorDatos:
    def __init__(self):
        random.seed(42)
        self.contadores = {"empleado": 0, "tecnico": 0, "admin": 0}
    
    def generar_nombre(self):
        return f"{random.choice(NOMBRES)} {random.choice(APELLIDOS)}"
    
    def generar_usuario(self, rol):
        self.contadores[rol] += 1
        prefijo = "APXADM" if rol == "admin" else "APXTEC" if rol == "tecnico" else "APXEMP"
        id_interno = f"{prefijo}{self.contadores[rol]:03d}"
        
        salario = random.randint(1200000, 5000000)
        return {
            "nombre": self.generar_nombre(),
            "user": id_interno,
            "pass": "1234",
            "rol": rol,
            "doc": f"CC-{random.randint(10000, 99999)}",
            "empresa": random.choice(EMPRESAS),
            "id_interno": id_interno,
            "costo": random.randint(30000, 50000) if rol == "tecnico" else 0,
            "salario": salario,
            "extra": salario / 200
        }
    
    def generar_placa(self):
        return f"{random.choice(PLACAS_BASE)}-{random.randint(100,999)}"

# ============================================================
# POBLADOR PRINCIPAL
# ============================================================
class PobladorMasivo:
    def __init__(self, config):
        self.config = config
        self.db = DBManager()
        self.gen = GeneradorDatos()
        print("="*60)
        print(f"🌱 POBLANDO - {self.config['empleados']} emp, {self.config['vehiculos']} veh")
        print("="*60)
    
    def poblar_usuarios(self):
        print("\n👥 USUARIOS:")
        # Admin
        admin = self.gen.generar_usuario("admin")
        self.db.registrar_usuario_full_pro(admin)
        print(f"   ✅ Admin: {admin['nombre']}")
        
        # Técnicos
        tecnicos = max(1, int(self.config['empleados'] * 0.1))
        for i in range(tecnicos):
            u = self.gen.generar_usuario("tecnico")
            self.db.registrar_usuario_full_pro(u)
        print(f"   ✅ {tecnicos} técnicos")
        
        # Empleados
        empleados = self.config['empleados'] - tecnicos - 1
        for i in range(empleados):
            u = self.gen.generar_usuario("empleado")
            self.db.registrar_usuario_full_pro(u)
        print(f"   ✅ {empleados} empleados")
    
    def poblar_vehiculos(self):
        print("\n🚛 VEHÍCULOS:")
        placas = set()
        for i in range(self.config['vehiculos']):
            placa = self.gen.generar_placa()
            while placa in placas:
                placa = self.gen.generar_placa()
            placas.add(placa)
            modelo = random.choice(MODELOS)
            self.db.insertar_vehiculo(placa, modelo)
        print(f"   ✅ {self.config['vehiculos']} vehículos")
    
    def poblar_referencias(self):
        print("\n📦 REFERENCIAS:")
        for i in range(self.config['referencias']):
            ref = {
                "nombre": f"Producto {i+1}",
                "desc": "Descripción de prueba",
                "costo": random.randint(50000, 200000),
                "piezas": json.dumps(["Pieza1", "Pieza2", "Pieza3"])
            }
            self.db.insertar_referencia_maestra(
                ref['nombre'], ref['desc'], ref['costo'], ref['piezas']
            )
        print(f"   ✅ {self.config['referencias']} referencias")
    
    def poblar_historial(self):
        print("\n📅 RUTAS Y ASISTENCIA:")
        vehiculos = self.db.obtener_lista_vehiculos()
        empleados = self.db.obtener_lista_personal()
        
        if not vehiculos or not empleados:
            print("   ❌ Faltan datos base")
            return
        
        nombres_emp = [e[0] for e in empleados if e[1] in ['empleado', 'tecnico']]
        fecha_fin = datetime.now()
        fecha_ini = fecha_fin - timedelta(days=self.config['dias'])
        
        total_rutas = 0
        fecha_actual = fecha_ini
        
        while fecha_actual <= fecha_fin:
            fecha_str = fecha_actual.strftime("%Y-%m-%d")
            
            # Crear 2-5 rutas por día
            for _ in range(random.randint(2, 5)):
                vehiculo = random.choice(vehiculos)[1]
                num_emp = random.randint(1, 3)
                empleados_ruta = random.sample(nombres_emp, min(num_emp, len(nombres_emp)))
                
                if self.db.guardar_plan_ruta(
                    fecha_str, vehiculo, empleados_ruta, 
                    "08:00 AM", "06:00 PM"
                ):
                    total_rutas += 1
                    
                    # Algunas marcas de asistencia
                    for emp in empleados_ruta:
                        if random.random() < 0.7:  # 70% asisten
                            self.db.registrar_asistencia_db(emp, "entrada", vehiculo)
                            if random.random() < 0.9:  # 90% hacen todo
                                self.db.registrar_asistencia_db(emp, "salida", vehiculo)
            
            fecha_actual += timedelta(days=1)
        
        print(f"   ✅ {total_rutas} rutas creadas")
        print(f"   ✅ {self.config['dias']} días de historial")
    
    def mostrar_estadisticas(self):
        print("\n" + "="*60)
        print("📊 ESTADÍSTICAS FINALES")
        print("="*60)
        
        with self.db.conectar() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM usuarios")
            print(f"👥 Usuarios: {cursor.fetchone()[0]}")
            
            cursor.execute("SELECT COUNT(*) FROM vehiculos")
            print(f"🚛 Vehículos: {cursor.fetchone()[0]}")
            
            cursor.execute("SELECT COUNT(*) FROM planeacion_rutas")
            print(f"📅 Rutas: {cursor.fetchone()[0]}")
            
            cursor.execute("SELECT COUNT(*) FROM asistencia")
            print(f"⏱️  Asistencias: {cursor.fetchone()[0]}")
    
    def ejecutar(self):
        if not eliminar_base_segura():
            print("❌ Cancelado por usuario")
            return
        
        inicio = time.time()
        
        self.poblar_usuarios()
        self.poblar_vehiculos()
        self.poblar_referencias()
        self.poblar_historial()
        
        self.mostrar_estadisticas()
        
        print(f"\n✨ COMPLETADO en {time.time()-inicio:.2f} segundos")
        print("🔑 Credenciales: APXADM001 / 1234")

# ============================================================
# EJECUCIÓN
# ============================================================
if __name__ == "__main__":
    print("""
    ╔════════════════════════════════════════════════╗
    ║  🌱 POBLADOR FUNCIONAL - APEX ERP              ║
    ╚════════════════════════════════════════════════╝
    """)
    
    print("Volumen:")
    print("1. BÁSICO (20 emp, 10 veh, 20 ref, 30 días)")
    print("2. MEDIO  (50 emp, 25 veh, 50 ref, 90 días)")
    print("3. ALTO   (100 emp, 50 veh, 100 ref, 180 días)")
    
    opcion = input("\nOpción [2]: ").strip()
    
    if opcion == "1":
        VOLUMEN = "BASICO"
    elif opcion == "3":
        VOLUMEN = "ALTO"
    else:
        VOLUMEN = "MEDIO"
    
    cfg = CONFIG[VOLUMEN]
    poblador = PobladorMasivo(cfg)
    poblador.ejecutar()