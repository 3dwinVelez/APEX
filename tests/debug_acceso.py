

import sys
import os

# --- Ajuste de rutas (Tu seguro de vida) ---
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ruta_raiz)

from data.db_manager import DBManager
from core.seguridad import Autenticador, Seguridad

db = DBManager()

def diagnostico():
    print("--- 🩺 DIAGNÓSTICO DE ACCESO ---")
    
    # 1. Intentamos crear el usuario (si ya existe, no pasa nada)
    db.registrar_usuario("pedro_tecnico", "tec123", "tecnico")
    
    # 2. Paso 1: ¿El usuario existe y la clave es correcta?
    sesion = Autenticador.validar_acceso(db, "pedro_tecnico", "tec123")
    
    if sesion:
        print(f"✅ PASO 1 EXITOSO: Usuario encontrado. Datos: {sesion}")
        
        # 3. Paso 2: ¿Tiene el permiso correcto?
        # Vamos a ver qué pasa aquí adentro
        print(f"🧐 Comparando rol del usuario '{sesion['rol']}' contra permiso requerido 'tecnico'")
        
        tiene_permiso = Seguridad.tiene_permiso(sesion, ['tecnico'])
        
        if tiene_permiso:
            print("🚀 PASO 2 EXITOSO: Acceso total concedido.")
        else:
            print("❌ PASO 2 FALLIDO: El rol no coincide con la lista permitida.")
            
    else:
        print("❌ PASO 1 FALLIDO: No se encontró al usuario con esa clave.")

if __name__ == "__main__":
    diagnostico()