import os
import json 
from datetime import datetime
import psycopg2
from psycopg2 import extras
from dotenv import load_dotenv

# datos del .env cargar las variables de entorno del ambiente 
load_dotenv()

class DBManager:  
    """
    🗄️ GESTOR DE BASE DE DATOS APEX - VERSIÓN NUBE (PostgreSQL)
    Clase encargada de la persistencia de datos (Motor de APEX)
    """ 
    def __init__(self):
        # 🔑 USA TUS CREDENCIALES POR SEPARADO AQUÍ
        self.db_config = {
            "host": os.getenv("DB_HOST"),
            "database": os.getenv("DB_NAME"),
            "user": os.getenv("DB_USER"),
            "password": os.getenv("DB_PASS"), 
            "port": "6543" ,
            "connect_timeout": 10  # Para que no se quede colgado esperando
        }
        self.crear_tablas()
        self.actualizar_estructura_personal()

    def conectar(self):
        """Establece conexión limpia usando el diccionario de configuración"""
        try:
            # Desempaquetamos el diccionario con **
            conn = psycopg2.connect(**self.db_config)
            return conn
        except Exception as e:
            print(f"❌ Error de sincronía con la nube: {e}")
            return None
    
    # ==========================================================
    # ⚙️ SECCIÓN: INICIALIZACIÓN (Afecta a todo el Sistema)
    # ==========================================================
    def crear_tablas(self):
        """Crea la estructura completa de APEX en PostgreSQL"""
        
        # Nota: Cambiamos AUTOINCREMENT por SERIAL y ? por %s (Sintaxis Postgres)
        sql_usuarios = """ 
        CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre TEXT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                rol TEXT NOT NULL,
                documento TEXT,               
                empresa TEXT,                  
                id_interno TEXT,               
                costo_servicio REAL DEFAULT 0, 
                salario_base REAL DEFAULT 0,   
                tasa_extra REAL DEFAULT 0      
        ); """

        sql_maestro_referencias = """
        CREATE TABLE IF NOT EXISTS maestro_referencias (
                id SERIAL PRIMARY KEY,
                nombre_referencia TEXT NOT NULL,
                descripcion TEXT,
                costo_mano_obra REAL DEFAULT 0,
                piezas_json TEXT
        ); """

        sql_ordenes_servicio = """
        CREATE TABLE IF NOT EXISTS ordenes_servicio (
                id SERIAL PRIMARY KEY,
                tecnico_id INTEGER,
                referencia_id INTEGER,
                fecha_creacion TEXT,
                costo_aplicado REAL,
                estado TEXT DEFAULT 'abierto',
                novedades_json TEXT,
                tiempo_total REAL DEFAULT 0,
                FOREIGN KEY (tecnico_id) REFERENCES usuarios (id),
                FOREIGN KEY (referencia_id) REFERENCES maestro_referencias (id)
        ); """

        sql_vehiculos = """
        CREATE TABLE IF NOT EXISTS vehiculos (
                id SERIAL PRIMARY KEY,
                placa TEXT UNIQUE NOT NULL,
                modelo TEXT,
                estado TEXT DEFAULT 'disponible'
        ); """

        sql_programacion_labores = """
        CREATE TABLE IF NOT EXISTS programacion_labores (
                id SERIAL PRIMARY KEY,
                fecha TEXT NOT NULL,
                vehiculo_id INTEGER,
                usuario_id INTEGER,
                estado_orden TEXT DEFAULT 'pendiente',
                FOREIGN KEY (vehiculo_id) REFERENCES vehiculos (id),
                FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ); """
        
        sql_asistencia = """
            CREATE TABLE IF NOT EXISTS asistencia (
                id SERIAL PRIMARY KEY,
                usuario TEXT,
                vehiculo_placa TEXT,
                tipo_marca TEXT, 
                hora TEXT,
                fecha TEXT,
                timestamp_unix REAL DEFAULT EXTRACT(EPOCH FROM NOW())
            ); """
        
        sql_planeacion_rutas = """
            CREATE TABLE IF NOT EXISTS planeacion_rutas (
                id SERIAL PRIMARY KEY,
                fecha TEXT,
                vehiculo_placa TEXT,
                empleados_json TEXT,
                hora_inicio_prog TEXT DEFAULT '08:00 AM',
                hora_fin_prog TEXT DEFAULT '06:00 PM', 
                estado TEXT DEFAULT 'PENDIENTE'
            ); """

        conn = self.conectar()
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute(sql_usuarios)
                cursor.execute(sql_maestro_referencias)
                cursor.execute(sql_ordenes_servicio)
                cursor.execute(sql_vehiculos)
                cursor.execute(sql_programacion_labores)
                cursor.execute(sql_asistencia)
                cursor.execute(sql_planeacion_rutas)
                
                cursor.execute("SELECT COUNT(*) FROM usuarios")
                if cursor.fetchone()[0] == 0:
                    cursor.execute("""
                        INSERT INTO usuarios 
                        (nombre, username, password, rol, salario_base, id_interno) 
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        ("Administrador", "admin", "1234", "admin", 0, "APXADM001"))
                conn.commit()
                print("✅ Maquinaria APEX sincronizada con la Nube")
            except Exception as e:
                print(f"❌ Error creando tablas en nube: {e}")
            finally:
                conn.close()

    def actualizar_estructura_personal(self):
        """Migración dinámica con protección de conexión"""
        columnas = [
            ("documento", "TEXT"), ("id_interno", "TEXT"), 
            ("empresa", "TEXT"), ("salario_base", "REAL"), 
            ("tasa_extra", "REAL"), ("costo_servicio", "REAL")
        ]
        conn = self.conectar()
        if conn: # <--- AGREGAMOS ESTA VALIDACIÓN
            try:
                cursor = conn.cursor()
                for nombre_col, tipo in columnas:
                    try:
                        cursor.execute(f"ALTER TABLE usuarios ADD COLUMN {nombre_col} {tipo}")
                    except:
                        conn.rollback()
                        continue
                conn.commit()
            finally:
                conn.close()

    # ==========================================================
    # 👥 SECCIÓN: GESTIÓN DE PERSONAL
    # ==========================================================
    
    def registrar_usuario_full_pro(self, d):
        """
        Versión simplificada para Supabase con ID autogenerado.
        """
        sql = """
            INSERT INTO usuarios 
            (nombre, username, password, rol, documento, empresa, id_interno, costo_servicio, salario_base, tasa_extra) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        try:
            with self.conectar() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(sql, (
                        d['nombre'], 
                        d['user'], 
                        d['pass'], 
                        d['rol'], 
                        d.get('doc', ''),
                        d.get('empresa', 'APEX'), 
                        d.get('id_interno', ''),
                        float(d.get('costo', 0)), 
                        float(d.get('salario', 0)), 
                        float(d.get('extra', 0))
                    ))
                    conn.commit()
                    return True
        except Exception as e:
            # Esto imprimirá el error exacto en los logs de Railway
            print(f"❌ Error real en Supabase: {e}")
            return False

    def obtener_lista_personal(self):
        """Retorna lista optimizada - Cierre de conexión garantizado"""
        conn = self.conectar()
        if not conn: return []
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT nombre, rol, salario_base, id_interno FROM usuarios ORDER BY nombre")
            return cursor.fetchall()
        finally:
            conn.close()

    def obtener_personal_completo(self):
        """Retorna todos los campos de usuarios para selects complejos"""
        with self.conectar() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, nombre, rol, id_interno FROM usuarios ORDER BY nombre")
            return cursor.fetchall()

    def actualizar_usuario(self, nombre_original, nuevo_nombre, rol, salario):
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE usuarios SET nombre=%s, rol=%s, salario_base=%s WHERE nombre=%s", 
                    (nuevo_nombre, rol, salario, nombre_original)
                )
                conn.commit()
                return True
        except Exception as e:
            print(f"❌ Error actualizando: {e}")
            return False

    def eliminar_usuario(self, nombre):
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM usuarios WHERE nombre=%s", (nombre,))
                conn.commit()
                return True
        except Exception as e:
            print(f"❌ Error eliminando: {e}")
            return False

    def contar_usuarios_por_rol(self, rol):
        with self.conectar() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM usuarios WHERE rol = %s", (rol.lower(),))
            res = cursor.fetchone()
            return res[0] if res else 0

    # ==========================================================
    # ⏱️ SECCIÓN: GESTIÓN DE HORARIOS Y RUTAS ASOCIADAS
    # ==========================================================

    def registrar_asistencia_db(self, usuario, tipo, placa, lat, lon):
        sql = """
            INSERT INTO asistencia (usuario, tipo, placa, latitud, longitud, fecha_hora)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """
        try:
            with self.conectar() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(sql, (usuario, tipo, placa, lat, lon))
                    conn.commit()
                    return True
        except Exception as e:
            print(f"❌ Error DB Asistencia: {e}")
            return False

        """
        Registra una marca (entrada, almuerzo, etc.) amarrada a un vehículo específico
        Args:
            usuario: Nombre del usuario
            tipo: "entrada", "almuerzo", "regreso", "salida"
            placa: Placa del vehículo asignado
        Returns:
            bool: True si éxito
        """
        

    def obtener_planes_empleado(self, nombre_usuario):
        """
        Busca todas las rutas (placas) donde el empleado está asignado hoy
        Args:
            nombre_usuario: Nombre del empleado a buscar
        Returns:
            list: Lista de dicts con {'placa': 'ABC-123'}
        """
        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        planes = []
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT vehiculo_placa, empleados_json FROM planeacion_rutas WHERE fecha = %s", 
                    (fecha_hoy,)
                )
                for placa, emps_json in cursor.fetchall():
                    empleados = json.loads(emps_json)
                    if nombre_usuario in empleados:
                        planes.append({"placa": placa})
            return planes
        except Exception as e:
            print(f"❌ Error al obtener planes: {e}")
            return []

    def obtener_marcas_por_vehiculo(self, usuario, placa):
        """Optimización de marcas del día"""
        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        marcas = {}
        conn = self.conectar()
        if not conn: return {}
        try:
            cursor = conn.cursor()
            cursor.execute(
                """SELECT tipo_marca, hora FROM asistencia 
                   WHERE usuario = %s AND vehiculo_placa = %s AND fecha = %s
                   ORDER BY id""",
                (usuario, placa, fecha_hoy)
            )
            for tipo, hora in cursor.fetchall():
                marcas[tipo] = hora
            return marcas
        finally:
            conn.close()
        
    """
    Trae las marcas de hoy filtradas por usuario Y vehículo
        Args:
        usuario: Nombre del usuario
        placa: Placa del vehículo
        Returns:
        dict: {tipo_marca: hora}
    """


    def obtener_ultima_marca_por_vehiculo(self, usuario, placa):
        """
        Determina el estado actual del flujo para un vehículo específico
        Args:
            usuario: Nombre del usuario
            placa: Placa del vehículo
        Returns:
            str: "entrada", "almuerzo", "regreso", "salida" o None
        """
        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """SELECT tipo_marca FROM asistencia 
                       WHERE usuario = %s AND vehiculo_placa = %s AND fecha = %s 
                       ORDER BY id DESC LIMIT 1""",
                    (usuario, placa, fecha_hoy)
                )
                res = cursor.fetchone()
                return res[0] if res else None
        except Exception as e:
            print(f"❌ Error obteniendo última marca: {e}")
            return None
        
    def obtener_rutas_filtradas(self, fecha=None, placa=None, empleado=None):
        """
        Obtiene rutas con filtros - VERSIÓN CORREGIDA
        Args:
            fecha: str YYYY-MM-DD o None (None = todas las fechas)
            placa: str o None (None = todas las placas)
            empleado: str o None (None = todos los empleados)
        Returns:
            list: Lista de dicts con datos de ruta
        """
        print(f"\n🔍 [DB] obtener_rutas_filtradas - Recibido:")
        print(f"   fecha: {fecha} (tipo: {type(fecha)})")
        print(f"   placa: {placa} (tipo: {type(placa)})")
        print(f"   empleado: {empleado} (tipo: {type(empleado)})")
        
        # Construir query base
        query = """SELECT vehiculo_placa, empleados_json, hora_inicio_prog, 
                        hora_fin_prog, fecha 
                FROM planeacion_rutas"""
        condiciones = []
        params = []

        # Agregar condiciones SOLO si el filtro NO es None
        if fecha is not None:
            condiciones.append("fecha = %s")
            params.append(fecha)
            print(f"   ➕ Filtro fecha: {fecha}")
        
        if placa is not None:
            condiciones.append("vehiculo_placa = %s")
            params.append(placa)
            print(f"   ➕ Filtro placa: {placa}")
        
        if empleado is not None:
            condiciones.append("empleados_json LIKE %s")
            params.append(f'%"{empleado}"%')
            print(f"   ➕ Filtro empleado: {empleado}")
        
        # Agregar condiciones a la query
        if condiciones:
            query += " WHERE " + " AND ".join(condiciones)
        
        # Ordenar por fecha descendente
        query += " ORDER BY fecha DESC"
        
        print(f"📝 Query final: {query}")
        print(f"📝 Params: {params}")

        rutas = []
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                resultados = cursor.fetchall()
                print(f"📊 Resultados encontrados: {len(resultados)}")
                
                for row in resultados:
                    try:
                        empleados = json.loads(row[1]) if row[1] else []
                        ruta = {
                            "placa": row[0],
                            "equipo": empleados,
                            "h_inicio": row[2] if row[2] else "08:00",
                            "h_fin": row[3] if row[3] else "18:00",
                            "fecha": row[4]
                        }
                        print(f"   - Ruta: {ruta['placa']} - Equipo: {ruta['equipo']}")
                        rutas.append(ruta)
                    except json.JSONDecodeError as e:
                        print(f"   ❌ Error decodificando JSON: {e}")
                        continue
                        
                return rutas
                
        except Exception as e:
            print(f"❌ Error en filtros: {e}")
            import traceback
            traceback.print_exc()
            return []

    # ==========================================================
    # 📅 SECCIÓN: PLANEACIÓN
    # ==========================================================

    def guardar_plan_ruta(self, fecha, placa, empleados, h_inicio="08:00 AM", h_fin="06:00 PM"):
        """
        Guarda el plan con el horario de jornada definido
        Args:
            fecha: str YYYY-MM-DD
            placa: str
            empleados: list de nombres
            h_inicio: str "HH:MM AM/PM"
            h_fin: str "HH:MM AM/PM"
        Returns:
            bool: True si éxito
        """
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO planeacion_rutas 
                       (fecha, vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog) 
                       VALUES (%s, %s, %s, %s, %s)""",
                    (fecha, placa, json.dumps(empleados), h_inicio, h_fin)
                )
                conn.commit()
                return True
        except Exception as e:
            print(f"❌ Error al guardar plan: {e}")
            return False

    def obtener_todas_las_rutas_hoy(self):
        """Trae los planes incluyendo los horarios programados para hoy"""
        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        rutas = []
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """SELECT vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog 
                       FROM planeacion_rutas WHERE fecha = %s""", 
                    (fecha_hoy,)
                )
                for placa, emps_json, hi, hf in cursor.fetchall():
                    rutas.append({
                        "placa": placa, 
                        "equipo": json.loads(emps_json),
                        "h_inicio": hi,
                        "h_fin": hf
                    })
            return rutas
        except Exception as e:
            print(f"❌ Error obteniendo rutas: {e}")
            return []

    # ==========================================================
    # 🚛 SECCIÓN: VEHÍCULOS
    # ==========================================================
    
    def insertar_vehiculo(self, placa, modelo):
        """Registra un nuevo vehículo"""
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO vehiculos (placa, modelo, estado) VALUES (%s, %s, 'disponible')", 
                    (placa.upper(), modelo)
                )
                conn.commit()
                return True
        except Exception as e:
            print(f"❌ Error insertando vehículo: {e}")
            return False

    def obtener_lista_vehiculos(self):
        """Retorna lista de (id, placa, modelo, estado)"""
        with self.conectar() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, placa, modelo, estado FROM vehiculos ORDER BY placa")
            return cursor.fetchall()

    def obtener_vehiculos_activos(self):
        """Solo vehículos disponibles"""
        with self.conectar() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT placa FROM vehiculos WHERE estado = 'disponible' ORDER BY placa")
            return [row[0] for row in cursor.fetchall()]

    # ==========================================================
    # 📄 SECCIÓN: REFERENCIAS
    # ==========================================================
    
    def obtener_referencias_maestras(self):
        """Retorna todas las referencias del catálogo"""
        with self.conectar() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, nombre_referencia, descripcion, costo_mano_obra, piezas_json 
                FROM maestro_referencias 
                ORDER BY nombre_referencia
            """)
            return cursor.fetchall()

    def insertar_referencia_maestra(self, nombre, descripcion, costo, piezas_json):
        """Crea una nueva referencia en el catálogo"""
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO maestro_referencias 
                       (nombre_referencia, descripcion, costo_mano_obra, piezas_json) 
                       VALUES (%s, %s, %s, %s)""",
                    (nombre, descripcion, costo, piezas_json)
                )
                conn.commit()
                return True
        except Exception as e:
            print(f"❌ Error insertando referencia: {e}")
            return False

    def obtener_referencia_por_id(self, ref_id):
        """Obtiene una referencia específica por su ID"""
        with self.conectar() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM maestro_referencias WHERE id = %s", 
                (ref_id,)
            )
            return cursor.fetchone()

    # ==========================================================
    # 🔧 SECCIÓN: ÓRDENES DE SERVICIO
    # ==========================================================
    
    def crear_orden_servicio(self, tecnico_id, referencia_id):
        """Crea una nueva orden de servicio abierta"""
        fecha_actual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO ordenes_servicio 
                       (tecnico_id, referencia_id, fecha_creacion, estado) 
                       VALUES (%s, %s, %s, 'abierto')""",
                    (tecnico_id, referencia_id, fecha_actual)
                )
                conn.commit()
                return cursor.lastrowid
        except Exception as e:
            print(f"❌ Error creando orden: {e}")
            return None

    def finalizar_orden_servicio(self, orden_id, novedades_json, tiempo_total):
        """Cierra una orden de servicio con novedades y tiempo"""
        try:
            with self.conectar() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """UPDATE ordenes_servicio 
                       SET estado = 'cerrado', novedades_json = %s, tiempo_total = %s 
                       WHERE id = %s""",
                    (novedades_json, tiempo_total, orden_id)
                )
                conn.commit()
                return True
        except Exception as e:
            print(f"❌ Error finalizando orden: {e}")
            return False

    # ==========================================================
    # 🔑 SECCIÓN: LOGIN Y SESIÓN
    # ==========================================================
    
    def login_usuario(self, username, password):
        """Valida credenciales y retorna datos del usuario"""
        with self.conectar() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, nombre, rol, username FROM usuarios WHERE username = %s AND password = %s", 
                (username, password)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "nombre": row[1],
                    "rol": row[2],
                    "username": row[3]
                }
            return None
        
        
    # ==========================================================
    #  SECCIÓN: REPORTES 
    # ==========================================================
        
    
    # En db_manager.py, agregar estos métodos:

    def obtener_rutas_filtradas_rango(self, fecha_ini, fecha_fin, placa=None, empleado=None):
        """Obtiene rutas en un rango de fechas"""
        query = """SELECT fecha, vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog 
                FROM planeacion_rutas 
                WHERE fecha BETWEEN %s AND %s"""
        params = [fecha_ini, fecha_fin]
        
        if placa:
            query += " AND vehiculo_placa = %s"
            params.append(placa)
        
        if empleado:
            query += " AND empleados_json LIKE %s"
            params.append(f'%"{empleado}"%')
        
        query += " ORDER BY fecha DESC"
        
        rutas = []
        with self.conectar() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            for row in cursor.fetchall():
                try:
                    empleados = json.loads(row[2]) if row[2] else []
                    rutas.append({
                        "fecha": row[0],
                        "placa": row[1],
                        "equipo": empleados,
                        "h_inicio": row[3],
                        "h_fin": row[4]
                    })
                except:
                    continue
        return rutas

    def obtener_marcas_por_vehiculo_rango(self, usuario, placa, fecha_ini, fecha_fin):
        """Obtiene marcas de un usuario en un vehículo en rango de fechas"""
        with self.conectar() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT fecha, tipo_marca, hora 
                FROM asistencia 
                WHERE usuario = %s AND vehiculo_placa = %s 
                AND fecha BETWEEN %s AND %s
                ORDER BY fecha, id
            """, (usuario, placa, fecha_ini, fecha_fin))
            
            return [{"fecha": r[0], "tipo": r[1], "hora": r[2]} for r in cursor.fetchall()]


    # ==========================================================
    #  SECCIÓN: MEJORAS DE PERFORMANCE 
    # ==========================================================

    def obtener_todo_al_inicio(self):
        """
        ⚡ CONSULTA MAESTRA (Turbo Boost): 
        Carga Personal, Vehículos y Rutas en un solo viaje a la nube.
        """
        # Estructura de datos inicial por si la conexión falla
        datos = {
            "personal": [],
            "vehiculos": [],
            "rutas": []
        }
        
        conn = self.conectar()
        if not conn:
            return datos
            
        try:
            # Usamos un solo cursor para todas las consultas
            with conn.cursor() as cursor:
                # 1. 👥 Cargar Personal
                cursor.execute("SELECT nombre, rol, salario_base, id_interno FROM usuarios ORDER BY nombre")
                datos["personal"] = cursor.fetchall()
                
                # 2. 🚛 Cargar Vehículos
                cursor.execute("SELECT id, placa, modelo, estado FROM vehiculos ORDER BY placa")
                datos["vehiculos"] = cursor.fetchall()
                
                # 3. 📅 Cargar Rutas del Día
                fecha_hoy = datetime.now().strftime("%Y-%m-%d")
                cursor.execute("""
                    SELECT vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog 
                    FROM planeacion_rutas 
                    WHERE fecha = %s
                """, (fecha_hoy,))
                datos["rutas"] = cursor.fetchall()
                
            return datos
            
        except Exception as e:
            print(f"❌ Error en Consulta Maestra: {e}")
            return datos
        finally:
            # 🔌 Cerramos la puerta de la conexión siempre
            conn.close()

# Este bloque es el "encendido" de la maquinaria
if __name__ == "__main__":
    print("🚀 Iniciando secuencia de conexión APEX...")
    manager = DBManager()