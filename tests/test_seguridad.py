
import sys
import os

# Puente de rutas
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ruta_raiz)

from data.db_manager import DBManager
from core.seguridad import Autenticador

db = DBManager()

# 1. El Admin crea un usuario (esto lo haríamos una vez)
def crear_usuario_inicial():
    cursor = db.conn.cursor()
    # Usaremos claves simples por ahora, luego veremos cómo encriptarlas
    try:
        cursor.execute("INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)", 
                       ("edwin_admin", "12345", "admin"))
        db.conn.commit()
    except:
        pass # Por si ya existe

# 2. Simulamos el Login
crear_usuario_inicial()
user_input = "edwin_admin"
pass_input = "12345"

sesion = Autenticador.validar_acceso(db, user_input, pass_input)

if sesion:
    print(f"🔓 Bienvenido {sesion['username']}. Tienes permisos de: {sesion['rol']}")
    if sesion['rol'] == 'admin':
        print("🛠️ Acceso concedido al Maestro de Referencias.")
else:
    print("❌ Usuario o clave incorrectos.")