
import sys
import os

# 1. Calculamos la ruta de la carpeta raíz (un nivel arriba de donde estamos)
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# 2. Le decimos a Python que incluya esa ruta en su lista de búsqueda
if ruta_raiz not in sys.path:
    sys.path.insert(0, ruta_raiz)

# 3. ¡Ahora sí! Python ya sabe dónde están 'data' y 'core'
from data.db_manager import DBManager

def test_lectura():
    db = DBManager()
    
    print("🔍 Iniciando lectura de base de datos...")
    
    # Intentamos traer a los empleados
    empleados = db.obtener_empleados()
    
    if not empleados:
        print("📭 La base de datos está vacía. ¿Ya corriste el test_completo.py?")
    else:
        print(f"✅ Se encontraron {len(empleados)} registros:")
        for emp in empleados:
            # PISTA: emp[0] es ID, emp[1] es Nombre, emp[2] es Rol...
            print(f"-> [{emp[0]}] {emp[1]} - {emp[2]}")

if __name__ == "__main__":
    test_lectura()