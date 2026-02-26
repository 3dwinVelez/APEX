
import sys
import os

# --- Ajuste de rutas (Tu seguro de vida) ---
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ruta_raiz)

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