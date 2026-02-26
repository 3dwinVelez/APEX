from datetime import datetime

class CalculadorCostos: # Tu "Cerebro" financiero
    
    @staticmethod
    def calcular_horas_laboradas(entrada_str, salida_str):
        """
        Recibe dos strings de fecha/hora y devuelve el total de horas en decimal.
        Ejemplo: "2026-02-15 08:00:00" y "2026-02-15 10:30:00" -> 2.5
        """
        formato = "%Y-%m-%d %H:%M:%S"
        
        # 1. Convertimos el texto a "objetos de tiempo" para poder restar
        t_entrada = datetime.strptime(entrada_str, formato)
        t_salida = datetime.strptime(salida_str, formato)
        
        # 2. Obtenemos la diferencia (esto crea un objeto llamado timedelta)
        diferencia = t_salida - t_entrada
        segundos_totales = diferencia.total_seconds()
        
        horas = segundos_totales / 3600
        
        if horas < 0:
            return 0.0 # evitamos que un error de dedo genere horas negativas
        
        return round(horas, 2)

    @staticmethod
    def calcular_pago_con_extras(horas_totales, pago_hora):
        LIMITE_NORMAL = 8.0
        RECARGO = 1.25  # 25% adicional
        
        if horas_totales <= LIMITE_NORMAL:
            return horas_totales * pago_hora
        else:
            # 1. Calculamos las horas que sobran del límite
            horas_extras = horas_totales - LIMITE_NORMAL
            
            # 2. El pago de las primeras 8 horas (Precio normal)
            pago_normal = LIMITE_NORMAL * pago_hora
            
            # 3. El pago de las extras (Precio con recargo)
            pago_extra = horas_extras * (pago_hora * RECARGO)
            
            # 4. EL RESULTADO FINAL: La suma de ambos
            return round(pago_normal + pago_extra, 2)
        
    
    @staticmethod
    def calcular_pago(horas, pago_por_hora):
        # 1. Realiza la multiplicación
        total = horas * pago_por_hora
        
        # 2. REGLA DE NEGOCIO: 
        # Si el total supera 1,000,000, queremos que el sistema nos avise
        if total > 1000000:
            print("⚠️ ALERTA: Monto de pago inusual. Revisar horas.")
            
        return total
    
    @staticmethod
    def calcular_presupuesto_total(lista_empleados):
        """
        Recibe una lista de tuplas (la que viene de la DB)
        y suma todos los salarios_hora.
        """
        total_por_hora = 0
        
        for emp in lista_empleados:
            # Recuerda que emp[3] es el salario_hora en tu tabla
            salario = emp[3] 
            total_por_hora += salario
            
        return total_por_hora