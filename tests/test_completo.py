
import sys
import os

# --- Ajuste de rutas (Tu seguro de vida) ---
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ruta_raiz)

from data.db_manager import DBManager
from core.modelos import Empleado
from core.logica_costos import CalculadorCostos

def test_ciclo_completo():
    print("🚀 INICIANDO SUPER TEST DE INTEGRACIÓN")
    db = DBManager()
    calc = CalculadorCostos()

    # CAPA 1: Creamos al protagonista
    tecnico = Empleado(nombre="Edwin Programador", rol="Líder Técnico", salario_hora=40000)
    print(f"✅ Empleado creado: {tecnico.nombre}")

    # ESCENARIO: El técnico trabajó de 8:00 AM a 5:30 PM
    entrada = "2026-02-15 08:00:00"
    salida = "2026-02-15 17:30:00"

    # CAPA 2: El Cerebro con Horas Extra
    horas_lab = calc.calcular_horas_laboradas(entrada, salida)
    
    pago_total = calc.calcular_pago_con_extras(horas_lab, tecnico.salario_hora)
    
    print(f"📊 Reporte: {horas_lab} horas trabajadas.")
    print(f"💰 Total a pagar (con extras): ${pago_total}")

    # 4. CAPA 3: Guardamos al empleado en la DB para que no se pierda
    try:
        db.insertar_empleado(tecnico)
        print("💾 Datos guardados en 'Apex.db' exitosamente.")
    except Exception as e:
        print(f"❌ Error al guardar: {e}")

if __name__ == "__main__":
    test_ciclo_completo()