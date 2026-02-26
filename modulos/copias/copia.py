import flet as ft
from datetime import datetime

class HorariosModule:
    def __init__(self, page, db, sesion, volver_callback):
        self.page = page
        self.db = db
        self.sesion = sesion
        self.volver_callback = volver_callback

    # --- ADN APEX: ZONA SEGURA ---
    def zona_segura(self, contenido, col_size={"sm": 12, "md": 11, "lg": 10}):
        return ft.ResponsiveRow([
            ft.Column([
                ft.Container(
                    content=contenido,
                    padding=ft.padding.only(left=20, right=20, top=10, bottom=40)
                )
            ], col=col_size)
        ], alignment=ft.MainAxisAlignment.CENTER)

    # ==========================================================
    # 1. LOBBY DE CONTROL (Menú Principal)
    # ==========================================================
    def mostrar_control_horarios(self, e=None):
        self.page.clean()
        self.page.vertical_alignment = ft.MainAxisAlignment.START
        
        header = ft.Row([
            ft.Row([
                ft.IconButton(ft.Icons.ARROW_BACK_IOS_NEW_ROUNDED, 
                              on_click=lambda _: self.volver_callback(self.sesion["usuario"]),
                              icon_size=16),
                ft.Text("TIEMPOS Y PLANEACIÓN", size=22, weight="bold", color="#263238"),
            ]),
            ft.Text("SCJ OPERACIONES", size=11, weight="bold", color="#2E7D32")
        ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN)

        menu_grid = ft.ResponsiveRow(spacing=20, run_spacing=20)
        
        menu_grid.controls.append(
            self.crear_tarjeta_menu("MI ASISTENCIA", ft.Icons.FINGERPRINT_ROUNDED, "Registrar jornada laboral", self.vista_marcacion_asistencia)
        )
        menu_grid.controls.append(
            self.crear_tarjeta_menu("MONITOR DE RUTAS", ft.Icons.MONITOR_HEART_OUTLINED, "Estado de vehículos y personal", self.vista_ruta_diaria)
        )
        # 🟢 Este es el método que causaba el error, ahora está integrado abajo
        menu_grid.controls.append(
            self.crear_tarjeta_menu("PLANEACIÓN PRO", ft.Icons.EVENT_AVAILABLE_ROUNDED, "Asignación de equipo y flota", self.vista_planeacion_admin)
        )

        contenido = ft.Column([
            ft.Container(height=10),
            header,
            ft.Divider(height=30, color="#EEEEEE"),
            ft.Container(ft.Text("FLUJO DE TRABAJO", size=12, weight="bold", color="grey600"), padding=ft.padding.only(bottom=10)),
            menu_grid,
        ], scroll=ft.ScrollMode.AUTO)

        self.page.add(self.zona_segura(contenido))
        self.page.update()

    def crear_tarjeta_menu(self, titulo, icon, subtitulo, accion):
        return ft.Container(
            content=ft.Row([
                ft.Container(content=ft.Icon(icon, size=28, color="#2E7D32"), bgcolor="#F1F8E9", padding=15, border_radius=12),
                ft.Column([
                    ft.Text(titulo, weight="bold", size=16, color="#263238"),
                    ft.Text(subtitulo, size=12, color="grey600"),
                ], expand=True, spacing=2)
            ], vertical_alignment=ft.CrossAxisAlignment.CENTER),
            padding=25, bgcolor="white", border_radius=15, border=ft.border.all(1, "#E0E0E0"),
            on_click=accion, col={"sm": 12, "md": 6, "lg": 4},
            shadow=ft.BoxShadow(blur_radius=10, color="black12")
        )

    # ==========================================================
    # 2. VISTA PLANEACIÓN ADMIN (El método que faltaba)
    # ==========================================================
    def vista_planeacion_admin(self, e=None):
        self.page.clean()
        vehiculos = self.db.obtener_lista_vehiculos()
        personal = self.db.obtener_lista_personal()

        dd_vehiculo = ft.Dropdown(label="Vehículo Asignado 🚚", border_radius=10, bgcolor="#F8F9FA",
                                  options=[ft.dropdown.Option(v[1]) for v in vehiculos])
        
        lista_empleados_asignados = ft.Column(spacing=10)

        def agregar_fila_personal(e=None):
            dropdown_emp = ft.Dropdown(label=f"Personal {len(lista_empleados_asignados.controls) + 1}", 
                                       expand=True, border_radius=10,
                                       options=[ft.dropdown.Option(p[0]) for p in personal])
            fila = ft.Row([dropdown_emp, ft.IconButton(ft.Icons.DELETE_OUTLINE_ROUNDED, icon_color="red", 
                                                       on_click=lambda _: remover_fila(fila))])
            def remover_fila(obj):
                lista_empleados_asignados.controls.remove(obj)
                self.page.update()
            
            lista_empleados_asignados.controls.append(fila)
            self.page.update()

        def guardar_plan(e):
            seleccionados = [f.controls[0].value for f in lista_empleados_asignados.controls if f.controls[0].value]
            if dd_vehiculo.value and seleccionados:
                fecha_hoy = datetime.now().strftime("%Y-%m-%d")
                if self.db.guardar_plan_ruta(fecha_hoy, dd_vehiculo.value, seleccionados, "08:00 AM", "06:00 PM"):
                    self.mostrar_control_horarios()
            self.page.update()

        agregar_fila_personal() # Iniciar con una fila

        form_plan = ft.Container(
            content=ft.Column([
                ft.Text("NUEVA ASIGNACIÓN DE RUTA", weight="bold", size=20),
                ft.Divider(),
                dd_vehiculo,
                ft.Row([ft.Text("Equipo de Trabajo", weight="bold"), 
                        ft.TextButton("+ Agregar", on_click=agregar_fila_personal)], alignment="spaceBetween"),
                lista_empleados_asignados,
                ft.ElevatedButton("PUBLICAR PLANEACIÓN", bgcolor="#263238", color="white", 
                                  height=50, width=float("inf"), on_click=guardar_plan)
            ], spacing=15),
            padding=30, bgcolor="white", border_radius=20, shadow=ft.BoxShadow(blur_radius=15, color="black12")
        )

        cuerpo = ft.Column([
            ft.IconButton(ft.Icons.ARROW_BACK_IOS_NEW_ROUNDED, on_click=self.mostrar_control_horarios, icon_size=16),
            form_plan
        ])
        self.page.add(self.zona_segura(cuerpo, col_size={"sm": 12, "md": 8, "lg": 6}))
        self.page.update()

    # (Aquí siguen los métodos vista_marcacion_asistencia y vista_ruta_diaria igual que antes...)
    # [Mantener los métodos anteriores del bloque previo para completar la clase]