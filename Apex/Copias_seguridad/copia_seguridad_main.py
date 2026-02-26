import sys
import os
import flet as ft

# --- Ajuste de rutas ---
ruta_raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ruta_raiz)

from data.db_manager import DBManager
from modulos.personal import PersonalModule
from modulos.referencias import ReferenciasModule
from modulos.controlhorarios import HorariosModule
from modulos.servicios import ServiciosModule
from modulos.vehiculos import VehiculosModule

def main(page: ft.Page):
    page.title = "APEX | Enterprise System"
    page.theme_mode = ft.ThemeMode.LIGHT
    page.bgcolor = "#F0F2F5"
    page.padding = 0 # Mantener en 0 para controlar márgenes nosotros
    
    sesion = {"usuario": "Invitado", "rol": "admin"} # Rol quemado para pruebas
    
    try:
        db = DBManager()
    except Exception as e:
        page.add(ft.Text(f"Error crítico de DB: {e}", color="red"))
        return

    # --- FUNCIÓN DE MARGEN GLOBAL (ADN APEX) ---
    def zona_segura(contenido, col_size={"sm": 12, "md": 10, "lg": 8}):
        return ft.ResponsiveRow([
            ft.Column([
                ft.Container(content=contenido, padding=20)
            ], col=col_size)
        ], alignment="center")

    # ==========================================================
    # 1. MÓDULO DE LOGIN
    # ==========================================================
    def mostrar_login():
        page.clean()
        txt_user = ft.TextField(label="Usuario", border_radius=12, bgcolor="white")
        txt_pass = ft.TextField(label="Contraseña", password=True, border_radius=12, bgcolor="white")
        lbl_err = ft.Text("", color="red", size=12)

        def login_evt(e):
            usuario = db.login_usuario(txt_user.value, txt_pass.value)
            
            # Diagnosticamos qué está llegando de la DB
            if usuario:
                try:
                    # Guardamos los datos asegurándonos de que existan en la tupla
                    sesion["usuario_id"] = usuario[0]
                    sesion["usuario"] = usuario[1]
                    
                    # Si tu tabla de usuarios tiene el ROL en la columna 4 (índice 3)
                    # Si falla aquí, es porque la tabla no tiene esa columna
                    sesion["rol"] = usuario[3] if len(usuario) > 3 else "empleado"
                    
                    mostrar_lobby(sesion["usuario"])
                except IndexError as err:
                    lbl_err.value = f"Error de estructura en DB: {err}"
                    page.update()
            else:
                lbl_err.value = "Credenciales incorrectas."
                page.update()

        login_card = ft.Column([
            ft.Container(height=60),
            ft.Text("APEX", size=60, weight="bold", color="#263238"),
            ft.Text("Precision Management System", size=12, color="grey"),
            ft.Container(height=30),
            txt_user, 
            txt_pass, 
            lbl_err,
            ft.ElevatedButton(
                "INGRESAR", height=50, bgcolor="#263238", color="white",
                on_click=login_evt,
                style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10))
            ),
            ft.Text("v1.0.2 Responsive Edition", size=10, color="grey")
        ], horizontal_alignment="center")

        page.add(zona_segura(login_card, col_size={"sm": 11, "md": 6, "lg": 4}))
        page.update()

    # ==========================================================
    # 2. EL LOBBY CON MÁRGENES ESTÉTICOS
    # ==========================================================
    def mostrar_lobby(nombre_usuario):
        page.clean()
        
        def crear_item_maestro(titulo, emoji, callback):
            return ft.Container(
                content=ft.Row([ft.Text(emoji, size=20), ft.Text(titulo, weight="bold")], alignment="center"),
                padding=15, bgcolor="white", border_radius=12, border=ft.border.all(1, "#E0E0E0"), 
                on_click=callback, col={"xs": 6, "md": 3}
            )

        # Header con franja completa pero contenido alineado
        header_content = ft.ResponsiveRow([
            ft.Column([
                ft.Text(f"Hola, {nombre_usuario}", size=24, weight="bold", color="white"), 
                ft.Text("PANEL DE CONTROL APEX", color="white", size=11)
            ], col={"xs": 8, "sm": 9}),
            ft.Container(
                content=ft.Text("SALIR", color="white", size=10, weight="bold"), 
                padding=10, border=ft.border.all(1, "white"), border_radius=8, 
                on_click=lambda _: mostrar_login(),
                col={"xs": 4, "sm": 3}
            )
        ], alignment="spaceBetween", vertical_alignment="center")

        header = ft.Container(
            content=zona_segura(header_content, col_size={"sm": 12, "md": 11, "lg": 10}),
            bgcolor="#263238", padding=ft.padding.only(top=20, bottom=20),
            border_radius=ft.border_radius.only(bottom_left=30, bottom_right=30)
        )

        # Cuerpo con margen
        lobby_items = ft.Column([
            ft.Container(height=10),
            ft.Text("OPERACIONES", size=12, weight="bold", color="grey600"),
            ft.Container(
                content=ft.Row([ft.Text("🛠️"), ft.Text("Servicio Técnico", weight="bold", size=18)]),
                padding=25, bgcolor="white", border_radius=15, 
                border=ft.border.only(left=ft.border.BorderSide(5, "blue")),
                on_click=lambda _: ServiciosModule(page, db, sesion, mostrar_lobby).menu_servicio_tecnico()
            ),
            ft.Container(
                content=ft.Row([ft.Text("⏱️"), ft.Text("Control de Horarios", weight="bold", size=18)]),
                padding=25, bgcolor="white", border_radius=15, 
                border=ft.border.only(left=ft.border.BorderSide(5, "orange")),
                on_click=lambda _: HorariosModule(page, db, sesion, mostrar_lobby).mostrar_control_horarios()
            ),
            ft.Container(height=10),
            ft.Text("ADMINISTRACIÓN", size=12, weight="bold", color="grey600"),
            ft.ResponsiveRow([
                crear_item_maestro("Personal", "👥", lambda _: PersonalModule(page, db, sesion, mostrar_lobby).mostrar_maestro_personal()),
                crear_item_maestro("Referencias", "📄", lambda _: ReferenciasModule(page, db, sesion, mostrar_lobby).mostrar_maestro_referencias()),
                crear_item_maestro("Reportes", "📊", lambda _: print("Reportes")),
                crear_item_maestro("Vehiculos", "🚚", lambda _: VehiculosModule(page, db, sesion, mostrar_lobby).mostrar_maestro_vehiculos()),
            ], spacing=15, run_spacing=15),
            ft.Container(height=40)
        ])

        page.add(
            ft.Column([
                header,
                zona_segura(lobby_items, col_size={"sm": 12, "md": 11, "lg": 10})
            ], scroll="auto", expand=True)
        )
        page.update()

    mostrar_login()

if __name__ == "__main__":
    ft.app(target=main, view=ft.AppView.WEB_BROWSER, port=8080)