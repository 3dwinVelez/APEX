import json

class GestorServicios:
    """
    🔧 LÓGICA DE NEGOCIO PARA SERVICIOS TÉCNICOS
    Procesamiento de piezas, checklists y novedades
    """
    
    @staticmethod
    def formatear_piezas(texto_entrada):
        """
        Convierte texto separado por comas en lista limpia
        
        Args:
            texto_entrada: str "Motor, Bomba, Cable"
            
        Returns:
            list: ["Motor", "Bomba", "Cable"]
        """
        if not texto_entrada:
            return []
            
        # Limpiar espacios y separar por comas
        lista = [pieza.strip() for pieza in texto_entrada.split(",") if pieza.strip()]
        return lista

    @staticmethod
    def decodificar_piezas(json_db):
        """
        Convierte JSON de DB a lista de Python
        
        Args:
            json_db: str JSON almacenado
            
        Returns:
            list: Lista de piezas
        """
        if not json_db:
            return []
            
        try:
            return json.loads(json_db)
        except:
            print("❌ Error decodificando JSON de piezas")
            return []
    
    @staticmethod
    def preparar_checklist_vacio(db, referencia_id):
        """
        Genera diccionario de piezas listas para marcar
        
        Args:
            db: DBManager instance
            referencia_id: int ID de la referencia
            
        Returns:
            dict: {pieza: "pendiente"}
        """
        cursor = db.conn.cursor()
        cursor.execute("SELECT piezas_json FROM maestro_referencias WHERE id = ?", (referencia_id,))
        resultado = cursor.fetchone()
        
        if resultado and resultado[0]:
            try:
                piezas = json.loads(resultado[0])
                # Crear checklist con estado inicial
                return {pieza: "pendiente" for pieza in piezas}
            except:
                return {}
        return {}
    
    @staticmethod
    def procesar_revision_piezas(lista_piezas, estados_recibidos):
        """
        Une lista de piezas con estados y comentarios
        
        Args:
            lista_piezas: list Lista de nombres de piezas
            estados_recibidos: dict {pieza: {"estado": str, "novedad": str}}
            
        Returns:
            dict: Resultado final para guardar en DB
        """
        resultado_final = {}
        
        for pieza in lista_piezas:
            # Buscar estado enviado, si no existe por defecto es 'pendiente'
            info = estados_recibidos.get(pieza, {"estado": "pendiente", "novedad": ""})
            
            # Asegurar estructura completa
            resultado_final[pieza] = {
                "estado": info.get("estado", "pendiente"),
                "novedad": info.get("novedad", ""),
                "timestamp": info.get("timestamp", "")
            }
            
        return resultado_final
    
    @staticmethod
    def resumen_novedades(resultado_revision):
        """
        Genera resumen de novedades para reporte
        
        Args:
            resultado_revision: dict Resultado de procesar_revision_piezas
            
        Returns:
            dict: Conteo de estados
        """
        resumen = {
            "ok": 0,
            "falla": 0,
            "pendiente": 0,
            "novedades": []
        }
        
        for pieza, info in resultado_revision.items():
            estado = info.get("estado", "pendiente")
            if estado == "ok":
                resumen["ok"] += 1
            elif estado == "falla":
                resumen["falla"] += 1
                if info.get("novedad"):
                    resumen["novedades"].append({
                        "pieza": pieza,
                        "novedad": info["novedad"]
                    })
            else:
                resumen["pendiente"] += 1
                
        return resumen