import sys
import os
import base64
import flet as ft
from datetime import datetime
import threading 

# --- Ajuste de rutas ---
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ruta_raiz)

from data.db_manager import DBManager

# ==========================================================
# 📦 CLASE DE ESTADO (CACHÉ) - El "Cerebro" de APEX
# ==========================================================
class AppState:
    def __init__(self, db_manager):
        self.db = db_manager
        self.personal = []
        self.vehiculos = []
        self.rutas_hoy = []
        self.ultima_actualizacion = None

    def sincronizar(self):
        """🔄 Sincronización Optimizada: De 3 viajes a solo 1"""
        try:
            print("🌐 Sincronizando datos maestros desde Supabase...")
            # Llamamos a la consulta maestra
            paquete_datos = self.db.obtener_todo_al_inicio()
            
            # Repartimos los datos en el caché local
            self.personal = paquete_datos["personal"]
            self.vehiculos = paquete_datos["vehiculos"]
            self.rutas_hoy = paquete_datos["rutas"]
            
            self.ultima_actualizacion = datetime.now()
            print(f"✅ Sincronización completada en tiempo récord: {self.ultima_actualizacion}")
            return True
        except Exception as e:
            print(f"❌ Error al repartir datos del caché: {e}")
            return False

# Importes con manejo de excepciones para escalabilidad
try:
    from modulos.personal import PersonalModule
    from modulos.referencias import ReferenciasModule
    from modulos.controlhorarios import HorariosModule
    from modulos.servicios import ServiciosModule
    from modulos.vehiculos import VehiculosModule
    from modulos.reportes import ReportesModule
except ImportError:
    pass

# --- FUNCIÓN PARA CONVERTIR IMAGEN A BASE64 ---
def imagen_a_base64(ruta_imagen):
    try:
        with open(ruta_imagen, "rb") as imagen:
            return base64.b64encode(imagen.read()).decode()
    except Exception as e:
        print(f"⚠️ Error al convertir imagen: {e}")
        return None

def main(page: ft.Page):
    # --- CONFIGURACIÓN ESTÉTICA ---
    page.title = "APEX ERP | SCJ Soluciones Logísticas"
    page.theme_mode = ft.ThemeMode.LIGHT
    page.bgcolor = "#F0F2F5"
    page.padding = 0
    page.spacing = 0
    
    LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "logo_scj.png")
    logo_absoluto = os.path.abspath(LOGO_PATH)
    
    LOGO_BASE64 = None
    if os.path.exists(logo_absoluto):
        LOGO_BASE64 = imagen_a_base64(logo_absoluto)




    # --- INICIALIZACIÓN DE MOTORES ---
    db = DBManager()
    state = AppState(db) # <--- Activamos el Caché

    import threading

    def carga_inicial_background():
        """Ejecuta la sincronización sin bloquear la interfaz"""
        state.sincronizar()
        # Una vez cargado, si quieres que algo cambie visualmente (ej: un icono de check)
        # puedes usar page.update() aquí.
        print("⚡ Datos de la nube listos en segundo plano.")

    # Lanzamos el "hilo" de carga y continuamos con el Login de inmediato
    threading.Thread(target=carga_inicial_background, daemon=True).start()

    sesion = {
        "usuario": "Administrador",
        "nombre": "Administrador",
        "rol": "admin"
    }

    def zona_segura(contenido, col_size={"sm": 12, "md": 11, "lg": 10}):
        return ft.ResponsiveRow([
            ft.Column([
                ft.Container(content=contenido, padding=ft.padding.only(top=20, bottom=40))
            ], col=col_size)
        ], alignment=ft.MainAxisAlignment.CENTER)

    # ==========================================================
    # 1. LOGIN (SIN CAMBIOS EN LÓGICA)
    # ==========================================================
    def mostrar_login(e=None):
        page.clean()
        page.vertical_alignment = ft.MainAxisAlignment.CENTER
        page.horizontal_alignment = ft.CrossAxisAlignment.CENTER
        
        txt_user = ft.TextField(label="Usuario", border_radius=12, width=320, bgcolor="white")
        txt_pass = ft.TextField(label="Contraseña", password=True, border_radius=12, width=320, bgcolor="white")
        
        login_ui = ft.Stack([
            ft.Container(
                content=ft.Image(src_base64=LOGO_BASE64, opacity=0.05, width=650) if LOGO_BASE64 else ft.Container(),
                alignment=ft.alignment.center
            ),
            ft.Column([
                ft.Image(src_base64=LOGO_BASE64, width=140) if LOGO_BASE64 else ft.Text("📊 APEX", size=32),
                ft.Text("SISTEMA APEX", size=28, weight="bold"),
                ft.Text("SCJ Soluciones Logísticas", size=12, color="grey"),
                ft.Container(height=15),
                txt_user, txt_pass,
                ft.ElevatedButton(
                    "INGRESAR AL SISTEMA", height=50, width=320, bgcolor="#263238", color="white",
                    on_click=lambda _: mostrar_dashboard(sesion["usuario"]),
                    style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=12))
                ),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=15)
        ], alignment=ft.alignment.center)

        page.add(login_ui)
        page.update()

    # ==========================================================
    # 2. DASHBOARD (PASAMOS 'STATE' A LOS MÓDULOS)
    # ==========================================================
    def mostrar_dashboard(usuario_nombre=None):
        # Cada vez que entramos al Dashboard, podemos refrescar en segundo plano si queremos
        # state.sincronizar() 

        page.clean()
        page.vertical_alignment = ft.MainAxisAlignment.START
        
        header_content = ft.Row([
            ft.Row([
                ft.Container(
                    content=ft.Image(src_base64=LOGO_BASE64, height=45) if LOGO_BASE64 else ft.Text("📊", size=30),
                    padding=5, bgcolor="white", border_radius=10
                ),
                ft.Column([
                    ft.Text("SISTEMA APEX", size=20, weight="bold", color="white"), 
                    ft.Text("SCJ SOLUCIONES LOGÍSTICAS", color="#A5D6A7", size=10, weight="bold")
                ], spacing=0)
            ], spacing=15),
            ft.ElevatedButton("SALIR", on_click=mostrar_login, style=ft.ButtonStyle(color="white", bgcolor="#263238"))
        ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN)

        header = ft.Container(
            content=zona_segura(header_content),
            bgcolor="#263238", padding=ft.padding.only(top=10, bottom=10),
            shadow=ft.BoxShadow(blur_radius=10, color="black26")
        )

        def crear_tarjeta_erp(titulo, subtitulo, icon, color="#2E7D32", disponible=True, callback=None):
            return ft.Container(
                content=ft.Column([
                    ft.Row([ft.Icon(icon, color=color, size=28), ft.Text(titulo, weight="bold", size=16)], alignment=ft.MainAxisAlignment.START),
                    ft.Text(subtitulo, size=11, color="grey600") if disponible else ft.Text("Próximamente", italic=True, size=11),
                ], spacing=10),
                padding=25, bgcolor="white", border_radius=15, col={"xs": 12, "sm": 6, "md": 4},
                on_click=callback if disponible else None,
            )

        grid_items = ft.Column([
            # Sección 1: Operaciones Críticas
            ft.Container(ft.Text("OPERACIONES CRÍTICAS", size=12, weight="bold", color="grey600"), padding=ft.padding.only(top=10)),
            ft.ResponsiveRow([
                crear_tarjeta_erp("Servicio Técnico", "Gestión de reparaciones y campo", ft.icons.BUILD_CIRCLE_OUTLINED, "#1565C0", True, 
                                  lambda _: ServiciosModule(page, db, sesion, mostrar_dashboard).menu_servicio_tecnico()),
                crear_tarjeta_erp("Control Horarios", "Monitoreo de asistencia y GPS", ft.icons.TIMER_OUTLINED, "#2E7D32", True,
                                  lambda _: HorariosModule(page, db, sesion, mostrar_dashboard).mostrar_control_horarios()),
                crear_tarjeta_erp("Gestión de Flota", "Control de vehículos y rutas", ft.icons.LOCAL_SHIPPING_OUTLINED, "#FF8F00", True,
                                  lambda _: VehiculosModule(page, db, sesion, mostrar_dashboard).mostrar_maestro_vehiculos()),
            ], spacing=20, run_spacing=20),

            # Sección 2: Administración General (RESTABLECIDA)
            ft.Container(ft.Text("ADMINISTRACIÓN Y RRHH", size=12, weight="bold", color="grey600"), padding=ft.padding.only(top=20)),
            ft.ResponsiveRow([
                crear_tarjeta_erp("Gestión Personal", "Maestro de empleados y roles", ft.icons.PEOPLE_ALT_OUTLINED, "#455A64", True,
                                  lambda _: PersonalModule(page, db, sesion, mostrar_dashboard).mostrar_maestro_personal()),
                crear_tarjeta_erp("Documentación", "Contratos y referencias", ft.icons.FOLDER_SHARED_OUTLINED, "#455A64", True,
                                  lambda _: ReferenciasModule(page, db, sesion, mostrar_dashboard).mostrar_maestro_referencias()),
                crear_tarjeta_erp("Nómina y Pagos", "Cálculo de haberes y finanzas", ft.icons.ACCOUNT_BALANCE_WALLET_OUTLINED, "#455A64", False),
            ], spacing=20, run_spacing=20),

            # Sección 3: Expansión ERP (RESTABLECIDA)
            ft.Container(ft.Text("EXPANSIÓN EMPRESARIAL", size=12, weight="bold", color="grey600"), padding=ft.padding.only(top=20)),
            ft.ResponsiveRow([
                crear_tarjeta_erp("Inventarios", "Stock de repuestos y materiales", ft.icons.INVENTORY_2_OUTLINED, "#C62828", False),
                crear_tarjeta_erp("CRM Clientes", "Gestión de ventas y prospectos", ft.icons.HANDSHAKE_OUTLINED, "#C62828", False),
                crear_tarjeta_erp("CENTRO DE REPORTES", "Análisis y estadísticas de gestión", ft.icons.INSERT_CHART_OUTLINED, "#1565C0", True,
                                  lambda _: ReportesModule(page, db, sesion, mostrar_dashboard).menu_reportes()),
            ], spacing=20, run_spacing=20),
        ], spacing=10)

        contenido = ft.Column([header, zona_segura(grid_items)], scroll=ft.ScrollMode.AUTO, expand=True)
        
        if LOGO_BASE64:
            page.add(ft.Stack([ft.Container(content=ft.Image(src_base64=LOGO_BASE64, opacity=0.03, width=800), alignment=ft.alignment.center, expand=True), contenido], expand=True))
        else:
            page.add(contenido)
        
        page.update()

    mostrar_login()

if __name__ == "__main__":
    # Importante: Mantener el assets_dir para cargar recursos locales si es necesario
    # ft.app(target=main, assets_dir="assets", view=ft.AppView.WEB_BROWSER, port=8080)
    port = int(os.getenv("PORT", 8080))
    ft.run(
        main, 
        assets_dir="assets", 
        view=ft.AppView.WEB_BROWSER, 
        host="0.0.0.0", 
        port=port
    )