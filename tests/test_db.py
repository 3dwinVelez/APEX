import sys
import os

# 1. DIAGNÓSTICO DE RUTA (Para saber dónde estamos parados)
directorio_actual = os.path.dirname(os.path.abspath(__file__))
directorio_raiz = os.path.dirname(directorio_actual) # Sube un nivel a 'proyecto_scj'

print(f"DEBUG: Ejecutando desde: {directorio_actual}")
print(f"DEBUG: Buscando raíz en: {directorio_raiz}")

# 2. FORZAR LA ENTRADA AL BUSCADOR
if directorio_raiz not in sys.path:
    sys.path.insert(0, directorio_raiz) # .insert(0) lo pone como prioridad #1

# 3. INTENTO DE IMPORTACIÓN CON REPORTE
try:
    from data.db_manager import DBManager
    from core.modelos import Empleado
    print("✅ ¡CONEXIÓN EXITOSA ENTRE CAPAS!")
except ImportError as e:
    print(f"❌ Error crítico: No se encontró el módulo. {e}")
    print("--- Contenido de la raíz detectada ---")
    print(os.listdir(directorio_raiz) if os.path.exists(directorio_raiz) else "Ruta no encontrada")
    sys.exit()

def ejecutar_prueba():
    db = DBManager()
    nuevo = Empleado(nombre="Edwin Test", rol="Admin", salario_hora=50000)
    db.insertar_empleado(nuevo)
    print(f"🚀 Registro creado con éxito. ID: {nuevo.id}")

if __name__ == "__main__":
    ejecutar_prueba()