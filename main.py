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
# 👑 GESTOR DE SESIONES (DEFINIDO UNA SOLA VEZ)
# ==========================================================
class SesionManager:
    def __init__(self):
        self.usuario = None
        self.activa = False
        self.datos = {}
        
    def iniciar(self, usuario_data):
        self.datos = usuario_data
        self.usuario = usuario_data.get("usuario")
        self.activa = True
        print(f"✅ Sesión iniciada: {self.usuario}")
        
    def cerrar(self):
        self.activa = False
        self.usuario = None
        self.datos = {}
        print("👋 Sesión cerrada")
        
    def verificar(self):
        return self.activa
    
    def get_usuario(self):
        return self.usuario

# ==========================================================
# 📦 CLASE DE ESTADO (CACHÉ)
# ==========================================================
class AppState:
    def __init__(self, db_manager):
        self.db = db_manager
        self.personal = []
        self.vehiculos = []
        self.rutas_hoy = []
        self.ultima_actualizacion = None

    def sincronizar(self):
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
    
    # --- INICIALIZAR GESTOR DE SESIÓN (CRÍTICO) ---
    page.sesion = SesionManager()
    
    # --- INICIALIZACIÓN DE MOTORES ---
    try:
        db = DBManager()
        print("✅ DBManager conectado")
    except Exception as e:
        print(f"❌ Fallo al conectar DBManager: {e}")
        db = None 

    state = AppState(db)

    def carga_inicial_background():
        state.sincronizar()
        print("⚡ Datos de la nube listos en segundo plano.")

    threading.Thread(target=carga_inicial_background, daemon=True).start()

    # ==========================================================
    # FUNCIONES RESPONSIVE MEJORADAS
    # ==========================================================
    def get_responsive_values():
        """Obtiene valores responsive basados en el ancho"""
        width = page.width
        
        if width < 400:  # Móvil pequeño
            return {
                "padding": 8,
                "icon_size": 20,
                "title_size": 14,
                "card_height": 110,
                "login_width": 280,
                "titulo_login": 20,
                "subtitulo": 10,
                "boton_size": 35,
                "grid_cols": 1
            }
        elif width < 600:  # Móvil grande
            return {
                "padding": 12,
                "icon_size": 22,
                "title_size": 15,
                "card_height": 120,
                "login_width": 320,
                "titulo_login": 24,
                "subtitulo": 11,
                "boton_size": 40,
                "grid_cols": 2
            }
        elif width < 900:  # Tablet
            return {
                "padding": 15,
                "icon_size": 24,
                "title_size": 16,
                "card_height": 130,
                "login_width": 360,
                "titulo_login": 26,
                "subtitulo": 12,
                "boton_size": 45,
                "grid_cols": 3
            }
        else:  # Desktop
            return {
                "padding": 20,
                "icon_size": 26,
                "title_size": 17,
                "card_height": 140,
                "login_width": 400,
                "titulo_login": 28,
                "subtitulo": 12,
                "boton_size": 45,
                "grid_cols": 4
            }

    def zona_segura(contenido, col_size=None):
        """Márgenes responsive mejorados"""
        vals = get_responsive_values()
        
        if col_size is None:
            if page.width < 600:
                col_size = {"xs": 12}
            elif page.width < 900:
                col_size = {"sm": 11}
            else:
                col_size = {"md": 10, "lg": 9}
        
        return ft.ResponsiveRow([
            ft.Column([
                ft.Container(
                    content=contenido, 
                    padding=ft.padding.only(
                        left=vals["padding"],
                        right=vals["padding"],
                        top=10,
                        bottom=20
                    )
                )
            ], col=col_size)
        ], alignment=ft.MainAxisAlignment.CENTER)

    # ==========================================================
    # 1. LOGIN CORREGIDO
    # ==========================================================
    def mostrar_login(e=None):
        page.clean()
        page.vertical_alignment = ft.MainAxisAlignment.CENTER
        page.horizontal_alignment = ft.CrossAxisAlignment.CENTER
        
        vals = get_responsive_values()
        
        txt_user = ft.TextField(
            label="Usuario", 
            border_radius=8, 
            width=vals["login_width"], 
            bgcolor="white",
            border_color="#E0E0E0",
            focused_border_color="#263238",
            prefix_icon=ft.icons.PERSON,
            text_size=14
        )
        
        txt_pass = ft.TextField(
            label="Contraseña", 
            password=True, 
            border_radius=8, 
            width=vals["login_width"], 
            bgcolor="white",
            border_color="#E0E0E0",
            focused_border_color="#263238",
            prefix_icon=ft.icons.LOCK,
            text_size=14
        )
        
        def intentar_login(e):
            username = txt_user.value
            password = txt_pass.value
            
            # 🔐 VALIDACIÓN (MEJORAR CON TU DB)
            if username and password:
                # Datos del usuario
                datos_usuario = {
                    "usuario": username,
                    "nombre": username,
                    "rol": "admin",
                    "id": 1
                }
                
                # INICIAR SESIÓN
                page.sesion.iniciar(datos_usuario)
                
                # Ir al dashboard
                mostrar_dashboard(username)
            else:
                page.snack_bar = ft.SnackBar(
                    content=ft.Text("❌ Usuario y contraseña requeridos"),
                    bgcolor="#B71C1C",
                    duration=2000
                )
                page.snack_bar.open = True
                page.update()
        
        login_ui = ft.Stack([
            ft.Container(
                content=ft.Image(src=LOGO_URL, opacity=0.03, width=vals["login_width"]*2) if LOGO_URL else ft.Container(),
                alignment=ft.alignment.center
            ),
            ft.Container(
                content=ft.Column([
                    ft.Image(src=LOGO_URL, width=vals["login_width"]//2.5) if LOGO_URL else ft.Text("📊 APEX", size=32),
                    ft.Text("SISTEMA APEX", size=vals["titulo_login"], weight="bold"),
                    ft.Text("SCJ Soluciones Logísticas", size=vals["subtitulo"], color="grey"),
                    ft.Container(height=15),
                    txt_user, 
                    txt_pass,
                    ft.Container(height=10),
                    ft.ElevatedButton(
                        "INGRESAR", 
                        height=vals["boton_size"]+5, 
                        width=vals["login_width"], 
                        bgcolor="#263238", 
                        color="white",
                        on_click=intentar_login,
                        style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=8))
                    ),
                ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=10),
                bgcolor="white",
                padding=vals["padding"]*2,
                border_radius=16,
                border=ft.border.all(1, "#E0E0E0"),
                shadow=ft.BoxShadow(blur_radius=20, color="#20000000")
            )
        ], alignment=ft.alignment.center)

        page.add(login_ui)
        page.update()

    # ==========================================================
    # 2. DASHBOARD CORREGIDO
    # ==========================================================
    def mostrar_dashboard(usuario_nombre=None):
        # 🔐 VERIFICAR SESIÓN
        if not page.sesion.verificar():
            print("🚫 Sin sesión válida")
            mostrar_login()
            return
        
        page.clean()
        page.vertical_alignment = ft.MainAxisAlignment.START
        
        vals = get_responsive_values()
        
        # Header
        logo_header = ft.Image(src=LOGO_URL, height=35) if LOGO_URL else ft.Text("📊", size=25)
        
        header_content = ft.Row([
            ft.Row([
                ft.Container(
                    content=logo_header,
                    padding=5, bgcolor="white", border_radius=8
                ),
                ft.Column([
                    ft.Text("APEX", size=vals["title_size"]+2, weight="bold", color="white"), 
                    ft.Text("SCJ", color="#A5D6A7", size=8, weight="bold")
                ], spacing=0)
            ], spacing=8),
            ft.ElevatedButton(
                "SALIR", 
                on_click=lambda _: [page.sesion.cerrar(), mostrar_login()],
                style=ft.ButtonStyle(color="white", bgcolor="#455A64"),
                height=30,
                width=70
            )
        ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN)

        header = ft.Container(
            content=zona_segura(header_content),
            bgcolor="#263238", 
            padding=ft.padding.only(top=5, bottom=5)
        )

        def crear_tarjeta_erp(titulo, subtitulo, icon, color="#2E7D32", disponible=True, callback=None):
            """Tarjetas responsive ultra compactas"""
            
            return ft.Container(
                content=ft.Column([
                    ft.Row([
                        ft.Icon(icon, color=color, size=vals["icon_size"]),
                        ft.Text(titulo[:12], weight="bold", size=vals["title_size"]-1, color="#263238"),
                    ]),
                    ft.Text(
                        subtitulo[:20], 
                        size=9, 
                        color="grey600", 
                        max_lines=1,
                    ) if disponible else ft.Text(
                        "Próximo", 
                        italic=True, 
                        size=9, 
                        color="orange"
                    ),
                ], spacing=2, horizontal_alignment="center"),
                padding=vals["padding"],
                bgcolor="white",
                border_radius=8,
                border=ft.border.all(1, "#E0E0E0"),
                on_click=callback if disponible else None,
                ink=True,
                col={"xs": 12, "sm": 6, "md": 4, "lg": 3},
                height=vals["card_height"],
            )

        # Grid de módulos
        spacing = 8 if page.width < 400 else 10
        
        grid_items = ft.Column([
            ft.Container(ft.Text("OPERACIONES", size=10, weight="bold", color="grey600"), padding=8),
            ft.ResponsiveRow([
                crear_tarjeta_erp("Servicio Técnico", "Reparaciones", ft.icons.BUILD, "#1565C0", True,
                                  lambda _: ServiciosModule(page, db, page.sesion.datos, mostrar_dashboard).menu_servicio_tecnico()),
                crear_tarjeta_erp("Control Horarios", "Asistencia", ft.icons.TIMER, "#2E7D32", True,
                                  lambda _: HorariosModule(page, db, page.sesion.datos, mostrar_dashboard).mostrar_control_horarios()),
                crear_tarjeta_erp("Gestión Flota", "Vehículos", ft.icons.LOCAL_SHIPPING, "#FF8F00", True,
                                  lambda _: VehiculosModule(page, db, page.sesion.datos, mostrar_dashboard).mostrar_maestro_vehiculos()),
            ], spacing=spacing, run_spacing=spacing),
            
            ft.Container(ft.Text("ADMINISTRACIÓN", size=10, weight="bold", color="grey600"), padding=8),
            ft.ResponsiveRow([
                crear_tarjeta_erp("Personal", "Empleados", ft.icons.PEOPLE, "#455A64", True,
                                  lambda _: PersonalModule(page, db, page.sesion.datos, mostrar_dashboard).mostrar_maestro_personal()),
                crear_tarjeta_erp("Referencias", "Catálogos", ft.icons.FOLDER, "#455A64", True,
                                  lambda _: ReferenciasModule(page, db, page.sesion.datos, mostrar_dashboard).mostrar_maestro_referencias()),
                crear_tarjeta_erp("Nómina", "Próximo", ft.icons.ACCOUNT_BALANCE, "#455A64", False),
            ], spacing=spacing, run_spacing=spacing),
            
            ft.Container(ft.Text("ANÁLISIS", size=10, weight="bold", color="grey600"), padding=8),
            ft.ResponsiveRow([
                crear_tarjeta_erp("REPORTES", "Estadísticas", ft.icons.INSERT_CHART, "#1565C0", True,
                                  lambda _: ReportesModule(page, db, page.sesion.datos, mostrar_dashboard).menu_reportes()),
                crear_tarjeta_erp("KPIs", "Próximo", ft.icons.DASHBOARD, "#2E7D32", False),
                crear_tarjeta_erp("Exportar", "Próximo", ft.icons.DOWNLOAD, "#FF8F00", False),
            ], spacing=spacing, run_spacing=spacing),
        ], spacing=2)

        contenido = ft.Column([header, zona_segura(grid_items)], scroll=ft.ScrollMode.AUTO, expand=True)
        page.add(contenido)
        page.update()

    # Iniciar con login
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