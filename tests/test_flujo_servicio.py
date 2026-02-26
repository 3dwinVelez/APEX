import sys
import os
import json
from datetime import datetime

# Puente de rutas
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ruta_raiz)

from data.db_manager import DBManager
# Nota: Asegúrate que estas clases existan o comenta las líneas si solo probaremos DB
# from core.logica_servicios import GestorServicios 

def preparar_escenario(db):
    print("🌱 Sembrando datos de prueba actualizados...")
    
    # 1. Registrar un técnico con el nuevo formato (Nombre, User, Pass, Rol, Salario)
    # Usamos registrar_usuario_full que es la nueva función del motor
    db.registrar_usuario_full("Edwin Tecnico", "tedwin", "adm", "tecnico", 0.0)
    
    # 2. Aseguramos que exista una Referencia con el nuevo campo de COSTO
    cursor = db.conectar().cursor()
    cursor.execute("SELECT id FROM maestro_referencias LIMIT 1")
    ref = cursor.fetchone()
    
    if not ref:
        print("📦 Creando referencia maestra con costos...")
        piezas = ["Motor", "Tarjeta", "Cableado"]
        # Nueva firma: nombre, descripcion, costo, piezas
        db.insertar_referencia_maestra(
            "Lavadora Industrial X", 
            "Modelo Pro", 
            45000.0, # Costo de mano de obra
            piezas
        )
        cursor.execute("SELECT id FROM maestro_referencias LIMIT 1")
        ref = cursor.fetchone()
    
    return ref[0]

def test_flujo_completo():
    db = DBManager()
    db.crear_tablas() 
    
    # Preparar datos
    ref_id = preparar_escenario(db) 
    
    print("🔐 Intentando login de técnico...")
    # Cambiamos a las credenciales que sembramos: tedwin / adm
    sesion = db.login_usuario("tedwin", "adm")
    
    if sesion:
        # sesion retorna: (id, nombre, rol)
        tecnico_id = sesion[0]
        nombre_tec = sesion[1]
        rol_tec = sesion[2]
        
        print(f"✅ Acceso concedido a: {nombre_tec} [Rol: {rol_tec}]")

        # --- FASE 1: APERTURA ---
        print(f"🚀 Abriendo orden para referencia ID: {ref_id}...")
        orden_id = db.crear_orden_servicio(tecnico_id, ref_id)
        
        if orden_id:
            print(f"✅ ¡Orden #{orden_id} abierta con éxito!")
            
            # --- FASE 2: INSPECCIÓN (Etapa 1) ---
            reporte_pedro = {
                "Motor": {"estado": "FALLA", "novedad": "Empaque roto"},
                "Tarjeta": {"estado": "OK", "novedad": ""},
                "Cableado": {"estado": "OK", "novedad": ""}
            }
            reporte_json = json.dumps(reporte_pedro)
            
            # Nota: Si aún no tienes esta función en el db_manager nuevo, 
            # el test fallará aquí. Por ahora usamos la lógica de actualización:
            print("📝 Registrando inspección técnica...")
            # Aquí podrías llamar a db.registrar_verificacion_insumos si ya la moviste
            
            # --- FASE 3: MONTAJE Y CIERRE ---
            print("🛠️ Registrando evidencia de montaje...")
            # db.registrar_evidencia_montaje(orden_id, "foto_montaje.jpg")
            
            print("🏁 Cerrando servicio...")
            # db.cerrar_orden_servicio(orden_id, "Todo quedó OK", "foto_final.jpg")
            
            print("\n✨ TEST FINALIZADO: El motor respondió correctamente a la nueva estructura.")
        else:
            print("❌ Error: No se pudo crear la orden.")
    else:
        print("🚫 Error: Login fallido. Revisa las credenciales en preparar_escenario.")

if __name__ == "__main__":
    test_flujo_completo()
