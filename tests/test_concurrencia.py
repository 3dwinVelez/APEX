# test_concurrencia.py
import threading
import time
import requests
from concurrent.futures import ThreadPoolExecutor
import random

class TestCarga:
    def __init__(self, url_base, num_usuarios=50):
        self.url = url_base
        self.usuarios = num_usuarios
        self.resultados = []
        
    def simular_usuario(self, user_id):
        """Simula un usuario realizando acciones"""
        inicio = time.time()
        exitoso = True
        errores = 0
        
        try:
            # Simular login
            session = requests.Session()
            
            # 5-10 acciones por usuario
            for accion in range(random.randint(5, 10)):
                time.sleep(random.uniform(0.5, 2))  # Tiempo entre acciones
                
                # Simular diferentes endpoints
                endpoints = [
                    f"{self.url}/api/personal",
                    f"{self.url}/api/vehiculos",
                    f"{self.url}/api/rutas"
                ]
                
                resp = session.get(random.choice(endpoints))
                if resp.status_code != 200:
                    errores += 1
                    
        except Exception as e:
            exitoso = False
            errores += 1
            
        fin = time.time()
        
        self.resultados.append({
            "usuario": user_id,
            "exitoso": exitoso,
            "duracion": fin - inicio,
            "errores": errores
        })
    
    def ejecutar(self):
        print(f"🚀 Iniciando prueba con {self.usuarios} usuarios concurrentes")
        inicio = time.time()
        
        with ThreadPoolExecutor(max_workers=self.usuarios) as executor:
            futures = [executor.submit(self.simular_usuario, i) for i in range(self.usuarios)]
            
        fin = time.time()
        
        # Analizar resultados
        exitosos = sum(1 for r in self.resultados if r["exitoso"])
        duracion_promedio = sum(r["duracion"] for r in self.resultados) / len(self.resultados)
        errores_totales = sum(r["errores"] for r in self.resultados)
        
        print("\n" + "="*50)
        print("📊 RESULTADOS DE PRUEBA DE CARGA")
        print("="*50)
        print(f"👥 Usuarios simulados: {self.usuarios}")
        print(f"✅ Sesiones exitosas: {exitosos}/{self.usuarios}")
        print(f"⏱️ Tiempo total: {fin-inicio:.2f}s")
        print(f"⚡ Duración promedio por usuario: {duracion_promedio:.2f}s")
        print(f"❌ Errores totales: {errores_totales}")
        print("="*50)

# Ejecutar prueba
if __name__ == "__main__":
    test = TestCarga("https://tu-app.railway.app", num_usuarios=50)
    test.ejecutar()