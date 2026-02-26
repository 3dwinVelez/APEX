class Autenticador:
    """
    🔐 SISTEMA DE AUTENTICACIÓN APEX
    Validación de credenciales y gestión de cuentas
    """
    
    @staticmethod
    def validar_acceso(db, usuario, clave):
        """
        Consulta en DB si usuario y clave coinciden
        
        Args:
            db: DBManager instance
            usuario: str username
            clave: str password
            
        Returns:
            dict: {id, username, nombre, rol} o None
        """
        cursor = db.conn.cursor()
        query = "SELECT id, username, nombre, rol FROM usuarios WHERE username = ? AND password = ?"
        cursor.execute(query, (usuario, clave))
        
        resultado = cursor.fetchone()
        if resultado:
            return {
                "id": resultado[0], 
                "username": resultado[1],
                "nombre": resultado[2], 
                "rol": resultado[3]
            }
        return None

    @staticmethod
    def crear_cuenta(db, username, password, rol, nombre="", documento=""):
        """
        Crea nueva cuenta con validaciones
        
        Args:
            db: DBManager instance
            username: str Nombre de usuario (mínimo 4 caracteres)
            password: str Contraseña
            rol: str admin/tecnico/empleado
            nombre: str Nombre completo
            documento: str Identificación
            
        Returns:
            bool: True si éxito
        """
        # Validaciones
        if len(username) < 4:
            print("❌ El nombre de usuario es demasiado corto (mínimo 4 caracteres)")
            return False
            
        if len(password) < 3:
            print("❌ La contraseña es demasiado corta")
            return False
            
        # Verificar si usuario ya existe
        cursor = db.conn.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE username = ?", (username,))
        if cursor.fetchone():
            print("❌ El nombre de usuario ya existe")
            return False
        
        # Preparar datos para registro
        from modelos import Empleado
        import uuid
        
        id_interno = f"APX{rol[:3].upper()}{str(uuid.uuid4().hex[:4]).upper()}"
        
        datos = {
            "nombre": nombre or username,
            "user": username,
            "pass": password,
            "rol": rol,
            "doc": documento,
            "empresa": "APEX",
            "id_interno": id_interno,
            "costo": 0,
            "salario": 0,
            "extra": 0
        }
        
        return db.registrar_usuario_full_pro(datos)

    @staticmethod
    def cambiar_password(db, usuario_id, password_actual, password_nueva):
        """
        Cambia contraseña de usuario
        
        Args:
            db: DBManager instance
            usuario_id: int ID del usuario
            password_actual: str Contraseña actual
            password_nueva: str Nueva contraseña
            
        Returns:
            bool: True si éxito
        """
        cursor = db.conn.cursor()
        
        # Verificar contraseña actual
        cursor.execute(
            "SELECT id FROM usuarios WHERE id = ? AND password = ?", 
            (usuario_id, password_actual)
        )
        if not cursor.fetchone():
            print("❌ Contraseña actual incorrecta")
            return False
            
        # Actualizar contraseña
        try:
            cursor.execute(
                "UPDATE usuarios SET password = ? WHERE id = ?",
                (password_nueva, usuario_id)
            )
            db.conn.commit()
            return True
        except Exception as e:
            print(f"❌ Error cambiando password: {e}")
            return False


class Seguridad:
    """
    🛡️ CONTROL DE ACCESOS Y PERMISOS
    Verificación de roles y autorizaciones
    """
    
    @staticmethod
    def tiene_permiso(usuario_sesion, roles_permitidos):
        """
        Verifica si el rol del usuario está autorizado
        
        Args:
            usuario_sesion: dict {id, username, nombre, rol}
            roles_permitidos: list Lista de roles autorizados (ej: ["admin", "tecnico"])
            
        Returns:
            bool: True si tiene permiso
        """
        if not usuario_sesion:
            print("🚫 Acceso denegado: No hay sesión activa")
            return False
            
        if not isinstance(roles_permitidos, list):
            roles_permitidos = [roles_permitidos]
            
        if usuario_sesion.get('rol') in roles_permitidos:
            return True
        else:
            print(f"🚫 Acceso denegado: Rol {usuario_sesion.get('rol')} no autorizado")
            print(f"   Roles permitidos: {roles_permitidos}")
            return False
    
    @staticmethod
    def es_admin(usuario_sesion):
        """Verifica si es administrador"""
        return Seguridad.tiene_permiso(usuario_sesion, ["admin"])
    
    @staticmethod
    def es_tecnico(usuario_sesion):
        """Verifica si es técnico"""
        return Seguridad.tiene_permiso(usuario_sesion, ["admin", "tecnico"])
    
    @staticmethod
    def es_empleado(usuario_sesion):
        """Verifica si es empleado (cualquier rol)"""
        return usuario_sesion is not None
    
    @staticmethod
    def obtener_menu_por_rol(usuario_sesion):
        """
        Retorna menú personalizado según rol
        
        Args:
            usuario_sesion: dict Datos de sesión
            
        Returns:
            list: Opciones de menú permitidas
        """
        if not usuario_sesion:
            return []
            
        rol = usuario_sesion.get('rol', '')
        
        # Menú completo para admin
        if rol == 'admin':
            return ['personal', 'vehiculos', 'horarios', 'servicios', 'referencias', 'reportes']
        
        # Técnico puede ver servicios y horarios
        elif rol == 'tecnico':
            return ['servicios', 'horarios']
        
        # Empleado solo su asistencia
        elif rol == 'empleado':
            return ['horarios']  # Solo puede marcar asistencia
            
        return []