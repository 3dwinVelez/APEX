
import sys
import os

# Puente de rutas
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ruta_raiz)

from data.db_manager import DBManager
from core.logica_costos import CalculadorCostos

def test_flujo_nomina():
    db = DBManager()
    calc = CalculadorCostos()

    # 1. CAPA 3: Buscamos al empleado en la DB (Edwin Programador)
    print("🔍 Buscando empleado...")
    empleados = db.obtener_empleados()
    if not empleados:
        print("❌ No hay empleados. Registra uno primero.")
        return
    
    # Tomamos al primer empleado de la lista para la prueba
    edwin = empleados[-1] # El último registrado
    id_edwin = edwin[0]
    pago_hora_edwin = edwin[4] # El salario está en la columna 4 (índice 4)

    # 2. ESCENARIO: Trabajó 10 horas (8 normales + 2 extras)
    entrada = "2026-02-16 08:00:00"
    salida = "2026-02-16 18:00:00"

    # 3. CAPA 2: El Cerebro procesa
    horas = calc.calcular_horas_laboradas(entrada, salida)
    pago_final = calc.calcular_pago_con_extras(horas, pago_hora_edwin)

    print(f"📊 Procesando: {horas} horas para {edwin[2]}")
    print(f"💰 Resultado: ${pago_final}")

    # 4. CAPA 3: El Obrero guarda el resultado final
    db.registrar_jornada(id_edwin, entrada, salida, pago_final)

if __name__ == "__main__":
    test_flujo_nomina()