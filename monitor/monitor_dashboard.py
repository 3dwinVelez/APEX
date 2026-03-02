# monitor_dashboard.py
import psutil
import platform
from datetime import datetime, timedelta

class MonitorDashboard:
    def __init__(self, db_pool):
        self.db = db_pool
        self.historial = []
        self.inicio = datetime.now()
    
    def get_stats(self):
        """Obtiene estadísticas del sistema"""
        # CPU y Memoria
        cpu = psutil.cpu_percent(interval=1)
        memoria = psutil.virtual_memory()
        
        # Conexiones DB
        with self.db.getconn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT count(*) FROM pg_stat_activity;")
            conexiones_db = cursor.fetchone()[0]
        
        # Usuarios activos (últimos 5 minutos)
        ahora = datetime.now()
        hace_5min = ahora - timedelta(minutes=5)
        usuarios_activos = len([h for h in self.historial if h > hace_5min])
        
        return {
            "uptime": str(ahora - self.inicio).split('.')[0],
            "cpu": cpu,
            "memoria_uso": memoria.percent,
            "memoria_disponible_gb": round(memoria.available / (1024**3), 2),
            "conexiones_db": conexiones_db,
            "usuarios_activos_5min": usuarios_activos,
            "total_peticiones": len(self.historial)
        }
    
    def registrar_actividad(self, usuario):
        """Registra actividad de usuario"""
        self.historial.append(datetime.now())
        # Mantener solo últimas 1000 entradas
        if len(self.historial) > 1000:
            self.historial = self.historial[-1000:]