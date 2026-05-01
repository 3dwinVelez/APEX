import uuid
from datetime import datetime

"""
📐 MODELOS DE DATOS APEX
Clases base para todas las entidades del sistema
La función super() permite heredar comportamientos de la clase padre
"""

class EntidadBase:
    """
    Clase base que provee ID único y timestamp a todas las entidades
    """
    
    def __init__(self):
        """
        Genera ID único de 8 caracteres y fecha de creación
        
        Explicación UUID:
        - uuid.uuid4(): Genera identificador único universal aleatorio
        - .hex: Convierte a hexadecimal sin guiones
        - [:8]: Toma primeros 8 caracteres para ID legible
        """
        self.id = str(uuid.uuid4().hex[:8]).upper()
        
        """
        datetime.now(): Captura fecha/hora actual
        .strftime(): Formatea a texto legible
        %Y: Año (2023)
        %m: Mes (10)  
        %d: Día (25)
        %H:%M:%S: Hora:minuto:segundo
        """
        self.fecha_creacion = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.activo = True  # Soft delete

class Empleado(EntidadBase):
    """Modelo de empleado/personal"""
    def __init__(self, nombre, rol, salario_hora, documento="", id_interno=""):
        super().__init__()
        self.nombre = nombre
        self.rol = rol  # admin, tecnico, empleado
        self.salario_hora = float(salario_hora)
        self.documento = documento
        self.id_interno = id_interno or self.id

class RegistroJornada(EntidadBase):
    """Modelo de marcación de asistencia"""
    def __init__(self, empleado_id, tipo, gps="", foto_url="", motivo_extra=""):
        super().__init__()
        self.empleado_id = empleado_id
        self.tipo = tipo  # entrada / almuerzo / regreso / salida
        self.gps = gps
        self.foto_url = foto_url
        self.motivo_extra = motivo_extra
        self.fecha = datetime.now().strftime("%Y-%m-%d")
        self.hora = datetime.now().strftime("%I:%M:%S %p")

class Servicio(EntidadBase):
    """Modelo de orden de servicio"""
    def __init__(self, tecnico_id, referencia_id, novedades=None):
        super().__init__()
        self.tecnico_id = tecnico_id
        self.referencia_id = referencia_id
        self.novedades = novedades or {}  # Dict con resultados de inspección
        self.estado = "abierto"  # abierto, cerrado, cancelado
        self.tiempo_total = 0  # Horas trabajadas
        
class Vehiculo(EntidadBase):
    """Modelo de vehículo de flota"""
    def __init__(self, placa, modelo, tipo="camion"):
        super().__init__()
        self.placa = placa.upper()
        self.modelo = modelo 
        self.tipo = tipo  # camion, camioneta, moto
        self.estado = "disponible"  # disponible, en_ruta, mantenimiento