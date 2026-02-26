
import sys
import os

# 1. Calculamos la ruta de la carpeta raíz (un nivel arriba de donde estamos)
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# 2. Le decimos a Python que incluya esa ruta en su lista de búsqueda
if ruta_raiz not in sys.path:
    sys.path.insert(0, ruta_raiz)
    
from data.db_manager import DBManager
from core.logica_servicios import GestorServicios

def test_crear_maestro():
    db = DBManager()
    gestor = GestorServicios()

    # Simulación de entrada del Administrativo
    nombre_ref = "Aire Acondicionado Industrial V2"
    piezas_raw = "Compresor, Ventilador, Termostato, Filtro de Aire, Gas Refrigerante"
    
    # El Cerebro procesa la entrada ágil
    lista_limpia = gestor.formatear_piezas(piezas_raw)
    
    # El Obrero guarda en el Maestro
    db.insertar_referencia_maestra(nombre_ref, "Modelo 2026", lista_limpia)

    # Verificación: ¿Cómo lo vería el técnico?
    # (Buscamos la última referencia para probar)
    cursor = db.conn.cursor()
    cursor.execute("SELECT * FROM maestro_referencias ORDER BY id DESC LIMIT 1")
    ref = cursor.fetchone()
    
    piezas_para_checklist = gestor.decodificar_piezas(ref[3])
    print(f"\n📋 Checklist para el técnico en '{ref[1]}':")
    for i, p in enumerate(piezas_para_checklist, 1):
        print(f"  {i}. [ ] {p}")

if __name__ == "__main__":
    test_crear_maestro()