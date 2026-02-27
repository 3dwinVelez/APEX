import sys
import os
import flet as ft
from datetime import datetime
import threading 

# --- Ajuste de rutas ---
directorio_actual = os.path.dirname(os.path.abspath(__file__))
if directorio_actual not in sys.path:
    sys.path.insert(0, directorio_actual)

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
            paquete_datos = self.db.obtener_todo_al_inicio()
            self.personal = paquete_datos["personal"]
            self.vehiculos = paquete_datos["vehiculos"]
            self.rutas_hoy = paquete_datos["rutas"]
            self.ultima_actualizacion = datetime.now()
            print(f"✅ Sincronización completada: {self.ultima_actualizacion}")
            return True
        except Exception as e:
            print(f"❌ Error al sincronizar: {e}")
            return False

# Importes con manejo de excepciones
try:
    from modulos.personal import PersonalModule
    from modulos.referencias import ReferenciasModule
    from modulos.controlhorarios import HorariosModule
    from modulos.servicios import ServiciosModule
    from modulos.vehiculos import VehiculosModule
    from modulos.reportes import ReportesModule
except ImportError as e:
    print(f"⚠️ Módulo no cargado: {e}")

def main(page: ft.Page):
    # --- CONFIGURACIÓN ESTÉTICA ---
    page.title = "APEX ERP | SCJ Soluciones Logísticas"
    page.theme_mode = ft.ThemeMode.LIGHT
    page.bgcolor = "#F0F2F5"
    page.padding = 0
    page.spacing = 0
    
    LOGO_URL = "logo_scj.png"
    
    # --- INICIALIZACIÓN DE MOTORES ---
    try:
        db = DBManager()
        print("✅ DBManager conectado")
    except Exception as e:
        print(f"❌ Fallo al conectar DBManager: {e}")
        db = None 

    state = AppState(db)

    def carga_inicial_background():
        """Ejecuta la sincronización sin bloquear la interfaz"""
        state.sincronizar()
        print("⚡ Datos de la nube listos en segundo plano.")

    threading.Thread(target=carga_inicial_background, daemon=True).start()

    sesion = {
        "usuario": "Administrador",
        "nombre": "Administrador",
        "rol": "admin"
    }

    # --- FUNCIÓN DE MARGEN MEJORADA ---
    def zona_segura(contenido, col_size=None):
        """Aplica márgenes responsive según el tamaño de pantalla"""
        if col_size is None:
            # Responsive: 12 en móvil, 10 en tablet, 8 en desktop
            if page.width < 600:
                col_size = {"xs": 12}
            elif page.width < 900:
                col_size = {"sm": 10}
            else:
                col_size = {"md": 8, "lg": 8}
        
        return ft.ResponsiveRow([
            ft.Column([
                ft.Container(
                    content=contenido, 
                    padding=ft.padding.only(
                        left=15 if page.width < 600 else 20,
                        right=15 if page.width < 600 else 20,
                        top=15,
                        bottom=30
                    )
                )
            ], col=col_size)
        ], alignment=ft.MainAxisAlignment.CENTER)

    # ==========================================================
    # 1. LOGIN OPTIMIZADO
    # ==========================================================
    def mostrar_login(e=None):
        page.clean()
        page.vertical_alignment = ft.MainAxisAlignment.CENTER
        page.horizontal_alignment = ft.CrossAxisAlignment.CENTER
        
        # Ancho responsive del login
        ancho_login = 320 if page.width < 400 else 360 if page.width < 600 else 400
        
        txt_user = ft.TextField(
            label="Usuario", 
            border_radius=8, 
            width=ancho_login, 
            bgcolor="white",
            border_color="#E0E0E0",
            focused_border_color="#263238",
            prefix_icon=ft.icons.PERSON
        )
        
        txt_pass = ft.TextField(
            label="Contraseña", 
            password=True, 
            border_radius=8, 
            width=ancho_login, 
            bgcolor="white",
            border_color="#E0E0E0",
            focused_border_color="#263238",
            prefix_icon=ft.icons.LOCK
        )
        
        # Tamaños de texto responsive
        titulo_size = 24 if page.width < 400 else 28
        subtitulo_size = 11 if page.width < 400 else 12
        
        login_ui = ft.Stack([
            ft.Container(
                content=ft.Image(src=LOGO_URL, opacity=0.03, width=ancho_login*2) if LOGO_URL else ft.Container(),
                alignment=ft.alignment.center
            ),
            ft.Container(
                content=ft.Column([
                    ft.Image(src=LOGO_URL, width=ancho_login//2.5) if LOGO_URL else ft.Text("📊 APEX", size=32),
                    ft.Text("SISTEMA APEX", size=titulo_size, weight="bold"),
                    ft.Text("SCJ Soluciones Logísticas", size=subtitulo_size, color="grey"),
                    ft.Container(height=15),
                    txt_user, 
                    txt_pass,
                    ft.Container(height=10),
                    ft.ElevatedButton(
                        "INGRESAR", 
                        height=45, 
                        width=ancho_login, 
                        bgcolor="#263238", 
                        color="white",
                        on_click=lambda _: mostrar_dashboard(sesion["usuario"]),
                        style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=8))
                    ),
                ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=12),
                bgcolor="white",
                padding=30,
                border_radius=16,
                border=ft.border.all(1, "#E0E0E0"),
                shadow=ft.BoxShadow(blur_radius=20, color="#20000000")
            )
        ], alignment=ft.alignment.center)

        page.add(login_ui)
        page.update()

    # ==========================================================
    # 2. DASHBOARD CON TARJETAS RESPONSIVE
    # ==========================================================
    def mostrar_dashboard(usuario_nombre=None):
        page.clean()
        page.vertical_alignment = ft.MainAxisAlignment.START
        
        # Tamaños responsive
        logo_altura = 35 if page.width < 600 else 45
        titulo_header = 18 if page.width < 600 else 20
        
        logo_header = ft.Image(src=LOGO_URL, height=logo_altura) if LOGO_URL else ft.Text("📊", size=30)
        
        header_content = ft.Row([
            ft.Row([
                ft.Container(
                    content=logo_header,
                    padding=5, bgcolor="white", border_radius=8
                ),
                ft.Column([
                    ft.Text("SISTEMA APEX", size=titulo_header, weight="bold", color="white"), 
                    ft.Text("SCJ SOLUCIONES", color="#A5D6A7", size=9, weight="bold")
                ], spacing=0)
            ], spacing=10),
            ft.ElevatedButton("SALIR", on_click=mostrar_login, 
                style=ft.ButtonStyle(color="white", bgcolor="#455A64"),
                height=35
            )
        ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN)

        header = ft.Container(
            content=zona_segura(header_content),
            bgcolor="#263238", 
            padding=ft.padding.only(top=8, bottom=8)
        )

        def crear_tarjeta_erp(titulo, subtitulo, icon, color="#2E7D32", disponible=True, callback=None):
            """Crea tarjetas responsive minimalistas"""
            
            # Tamaños responsive
            if page.width < 400:
                padding = 12
                icon_size = 22
                title_size = 13
                altura = 120
            elif page.width < 600:
                padding = 15
                icon_size = 24
                title_size = 14
                altura = 130
            else:
                padding = 20
                icon_size = 26
                title_size = 15
                altura = 140
            
            return ft.Container(
                content=ft.Column([
                    ft.Row([
                        ft.Icon(icon, color=color, size=icon_size),
                        ft.Text(titulo, weight="bold", size=title_size, color="#263238"),
                    ], alignment=ft.MainAxisAlignment.START),
                    ft.Text(
                        subtitulo, 
                        size=10, 
                        color="grey600", 
                        max_lines=2,
                        overflow=ft.TextOverflow.ELLIPSIS
                    ) if disponible else ft.Text(
                        "Próximamente", 
                        italic=True, 
                        size=10, 
                        color="orange"
                    ),
                ], spacing=4),
                padding=padding,
                bgcolor="white",
                border_radius=10,
                border=ft.border.all(1, "#E0E0E0"),
                on_click=callback if disponible else None,
                ink=True,
                col={"xs": 12, "sm": 6, "md": 4, "lg": 3},
                height=altura,
            )

        # Grid de módulos con espaciado responsive
        spacing = 10 if page.width < 400 else 15
        run_spacing = 10 if page.width < 400 else 15
        
        grid_items = ft.Column([
            ft.Container(ft.Text("OPERACIONES", size=11, weight="bold", color="grey600"), padding=10),
            ft.ResponsiveRow([
                crear_tarjeta_erp("Servicio Técnico", "Reparaciones", ft.icons.BUILD_CIRCLE_OUTLINED, "#1565C0", True,
                                  lambda _: ServiciosModule(page, db, sesion, mostrar_dashboard).menu_servicio_tecnico()),
                crear_tarjeta_erp("Control Horarios", "Asistencia", ft.icons.TIMER_OUTLINED, "#2E7D32", True,
                                  lambda _: HorariosModule(page, db, sesion, mostrar_dashboard).mostrar_control_horarios()),
                crear_tarjeta_erp("Gestión Flota", "Vehículos", ft.icons.LOCAL_SHIPPING_OUTLINED, "#FF8F00", True,
                                  lambda _: VehiculosModule(page, db, sesion, mostrar_dashboard).mostrar_maestro_vehiculos()),
            ], spacing=spacing, run_spacing=run_spacing),
            
            ft.Container(ft.Text("ADMINISTRACIÓN", size=11, weight="bold", color="grey600"), padding=10),
            ft.ResponsiveRow([
                crear_tarjeta_erp("Personal", "Empleados", ft.icons.PEOPLE_ALT_OUTLINED, "#455A64", True,
                                  lambda _: PersonalModule(page, db, sesion, mostrar_dashboard).mostrar_maestro_personal()),
                crear_tarjeta_erp("Referencias", "Catálogos", ft.icons.FOLDER_SHARED_OUTLINED, "#455A64", True,
                                  lambda _: ReferenciasModule(page, db, sesion, mostrar_dashboard).mostrar_maestro_referencias()),
                crear_tarjeta_erp("Nómina", "Próximo", ft.icons.ACCOUNT_BALANCE_WALLET_OUTLINED, "#455A64", False),
            ], spacing=spacing, run_spacing=run_spacing),
            
            ft.Container(ft.Text("ANÁLISIS", size=11, weight="bold", color="grey600"), padding=10),
            ft.ResponsiveRow([
                crear_tarjeta_erp("REPORTES", "Estadísticas", ft.icons.INSERT_CHART_OUTLINED, "#1565C0", True,
                                  lambda _: ReportesModule(page, db, sesion, mostrar_dashboard).menu_reportes()),
                crear_tarjeta_erp("KPIs", "Próximo", ft.icons.DASHBOARD_OUTLINED, "#2E7D32", False),
                crear_tarjeta_erp("Exportar", "Próximo", ft.icons.DOWNLOAD_OUTLINED, "#FF8F00", False),
            ], spacing=spacing, run_spacing=run_spacing),
        ], spacing=5)

        contenido = ft.Column([header, zona_segura(grid_items)], scroll=ft.ScrollMode.AUTO, expand=True)
        
        page.add(contenido)
        page.update()

    mostrar_login()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    path_assets = os.path.join(os.path.dirname(__file__), "assets")
    
    ft.app(
        target=main, 
        assets_dir=path_assets, 
        view=ft.AppView.WEB_BROWSER, 
        host="0.0.0.0",
        port=port
    )