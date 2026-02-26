
import flet as ft

class ChatModule:
    def __init__(self, page, db, sesion, volver_callback):
        self.page = page
        self.db = db
        self.sesion = sesion
        self.volver_callback = volver_callback

    def mostrar_chat_interno(self, e=None):
        self.page.clean()
        
        def crear_burbuja(texto, es_mio=True):
            return ft.Container(
                content=ft.Text(texto, color="white" if es_mio else "black"),
                padding=12,
                bgcolor="#263238" if es_mio else "#E0E0E0",
                border_radius=ft.border_radius.only(
                    top_left=15, top_right=15, 
                    bottom_left=15 if es_mio else 2, 
                    bottom_right=2 if es_mio else 15
                ),
                alignment="center_right" if es_mio else "center_left",
                width=320
            )

        chat_lista = ft.Column(
            scroll="auto",
            expand=True,
            controls=[
                crear_burbuja("Sistema: Bienvenido al chat operativo.", False),
                crear_burbuja(f"Admin: Hola {self.sesion['usuario']}, recuerda marcar ingreso.", False),
            ]
        )

        txt_mensaje = ft.TextField(
            hint_text="Escribir mensaje...", 
            expand=True, 
            border_radius=20,
            bgcolor="white",
            content_padding=15
        )

        self.page.add(
            ft.Column([
                # Encabezado del Chat
                ft.Container(
                    content=ft.Row([
                        ft.Container(
                            content=ft.Text("←", size=25, color="white"), 
                            on_click=lambda _: self.volver_callback(self.sesion["usuario"]),
                            padding=10
                        ),
                        ft.Text("CHAT OPERATIVO", weight="bold", size=18, color="white"),
                    ]),
                    padding=10, bgcolor="#263238"
                ),
                # Cuerpo del Chat
                ft.Container(content=chat_lista, padding=20, expand=True),
                # Barra de entrada
                ft.Container(
                    content=ft.Row([
                        txt_mensaje, 
                        ft.Container(content=ft.Text("🚀", size=20), padding=10)
                    ]),
                    padding=10, bgcolor="#F0F2F5"
                )
            ], expand=True)
        )
        self.page.update()