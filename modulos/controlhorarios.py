import flet as ft
from datetime import datetime
import json

class HorariosModule:
    """
    ⏱️ MÓDULO DE CONTROL HORARIO - VERSIÓN RESPONSIVE
    """
    
    def __init__(self, page, db, sesion, volver_callback):
        self.page = page
        self.db = db
        self.sesion = sesion
        self.volver_callback = volver_callback

    def get_responsive_values(self):
        """Retorna valores responsive basados en el ancho de pantalla"""
        width = self.page.width
        
        if width < 400:
            return {
                "boton_size": 60,
                "padding": 10,
                "icon_size": 20,
                "title_size": 16,
                "spacing": 8,
                "columnas": 1
            }
        elif width < 600:
            return {
                "boton_size": 70,
                "padding": 15,
                "icon_size": 22,
                "title_size": 18,
                "spacing": 10,
                "columnas": 2
            }
        elif width < 900:
            return {
                "boton_size": 80,
                "padding": 20,
                "icon_size": 24,
                "title_size": 20,
                "spacing": 12,
                "columnas": 3
            }
        else:
            return {
                "boton_size": 85,
                "padding": 25,
                "icon_size": 26,
                "title_size": 22,
                "spacing": 15,
                "columnas": 4
            }

    def zona_segura(self, contenido, col_size=None):
        """Aplica márgenes responsive"""
        vals = self.get_responsive_values()
        
        if col_size is None:
            if self.page.width < 600:
                col_size = {"xs": 12}
            elif self.page.width < 900:
                col_size = {"sm": 10}
            else:
                col_size = {"md": 8, "lg": 8}
        
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
        ], alignment="center")

    def mostrar_control_horarios(self, e=None):
        """Menú principal del módulo"""
        self.page.clean()
        vals = self.get_responsive_values()
        
        header = ft.Row([
            ft.TextButton("← VOLVER", on_click=lambda _: self.volver_callback(self.sesion["usuario"])),
            ft.Text("TIEMPOS", size=vals["title_size"], weight="bold"),
        ], alignment="spaceBetween")

        menu_grid = ft.ResponsiveRow(spacing=vals["spacing"], run_spacing=vals["spacing"])
        
        menu_grid.controls.append(
            self.crear_tarjeta_menu("ASISTENCIA", "⏱️", "Registrar marcas", self.vista_marcacion_asistencia)
        )
        menu_grid.controls.append(
            self.crear_tarjeta_menu("RUTAS", "🚚", "Ver rutas", self.vista_ruta_diaria)
        )
        menu_grid.controls.append(
            self.crear_tarjeta_menu("PLANEACIÓN", "📅", "Asignar personal", self.vista_planeacion_admin)
        )

        contenido = ft.Column([
            ft.Container(height=10),
            header,
            ft.Container(height=15),
            ft.Text("GESTIÓN", size=11, weight="bold", color="grey"),
            menu_grid,
        ], scroll="auto")

        self.page.add(self.zona_segura(contenido))
        self.page.update()

    def crear_tarjeta_menu(self, titulo, emoji, subtitulo, accion):
        """Crea tarjetas de menú minimalistas"""
        vals = self.get_responsive_values()
        
        return ft.Container(
            content=ft.Row([
                ft.Text(emoji, size=vals["icon_size"]+6),
                ft.Column([
                    ft.Text(titulo, weight="bold", size=vals["title_size"]-2),
                    ft.Text(subtitulo, size=10, color="grey"),
                ], expand=True, spacing=1)
            ]),
            padding=vals["padding"],
            bgcolor="white",
            border_radius=10,
            border=ft.border.all(1, "#E0E0E0"),
            on_click=lambda _: accion(),
            col={"xs": 12, "sm": 6, "md": 4}
        )

    # ==========================================================
    # 1. ASISTENCIA CON GPS Y RESPONSIVE
    # ==========================================================
    def obtener_gps(self):
        """Captura ubicación con manejo de errores"""
        try:
            position = self.page.get_geolocator_position(timeout=10)
            if position:
                return position.latitude, position.longitude
            return None, None
        except Exception as e:
            print(f"❌ Error GPS: {e}")
            return None, None

    def vista_marcacion_asistencia(self, e=None):
        """Vista de marcación responsive"""
        self.page.clean()
        vals = self.get_responsive_values()
        ahora = datetime.now().strftime("%I:%M %p")
        
        nombre_usuario = self.sesion.get("usuario", "Administrador")
        mis_rutas = self.db.obtener_planes_empleado(nombre_usuario)
        
        # Dropdown responsive
        if mis_rutas:
            opciones_vehiculo = [ft.dropdown.Option(r["placa"]) for r in mis_rutas]
            hint_text = "Selecciona vehículo"
        else:
            opciones_vehiculo = [ft.dropdown.Option("SIN_VEHICULOS", "⚠️ Sin vehículos")]
            hint_text = "No hay vehículos"
        
        dd_vehiculo = ft.Dropdown(
            label="Vehículo",
            options=opciones_vehiculo,
            hint_text=hint_text,
            expand=True,
            border_radius=8,
            dense=True
        )

        zona_botones = ft.Column()
        info_text = ft.Text("", size=11, color="grey", italic=True)

        def cargar_controles(e):
            if not dd_vehiculo.value or dd_vehiculo.value == "SIN_VEHICULOS":
                info_text.value = "❌ No tienes vehículos asignados"
                self.page.update()
                return

            placa = dd_vehiculo.value
            marcas = self.db.obtener_marcas_por_vehiculo(nombre_usuario, placa)
            ultima = self.db.obtener_ultima_marca_por_vehiculo(nombre_usuario, placa)

            def determinar_estado(tipo):
                if not ultima:
                    return tipo == "entrada"
                if ultima == "entrada":
                    return tipo == "almuerzo"
                if ultima == "almuerzo":
                    return tipo == "regreso"
                if ultima == "regreso":
                    return tipo == "salida"
                return False

            def crear_boton(texto, emoji, color, tipo_m):
                habilitado = determinar_estado(tipo_m)
                hora_m = marcas.get(tipo_m, "--:--")
                
                tamano = vals["boton_size"]
                
                if hora_m != "--:--":
                    bg_color = "#455A64"
                elif habilitado:
                    bg_color = color
                else:
                    bg_color = "#B0BEC5"
                
                return ft.Container(
                    content=ft.Column([
                        ft.Text(emoji, size=tamano//3),
                        ft.Text(texto[:3], size=tamano//8, weight="bold", color="white"),
                        ft.Text(hora_m, size=tamano//9, color="white70"),
                    ], horizontal_alignment="center", spacing=2),
                    bgcolor=bg_color,
                    width=tamano,
                    height=tamano,
                    border_radius=10,
                    padding=tamano//10,
                    on_click=lambda _, t=tipo_m, p=placa: self.registrar_marca(t, p) if habilitado else None,
                )

            zona_botones.controls = [
                ft.Row([
                    crear_boton("ENT", "🚀", "#1B5E20", "entrada"),
                    crear_boton("ALM", "🍴", "#E65100", "almuerzo"),
                    crear_boton("REG", "🏢", "#01579B", "regreso"),
                    crear_boton("SAL", "🏠", "#B71C1C", "salida"),
                ], alignment=ft.MainAxisAlignment.CENTER, spacing=vals["spacing"])
            ]
            
            if not ultima:
                info_text.value = "👇 Marca ENTRADA"
            elif ultima == "salida":
                info_text.value = "✅ Jornada completada"
            else:
                info_text.value = f"👉 Siguiente: {ultima}"
            
            self.page.update()

        btn_cargar = ft.ElevatedButton(
            "CARGAR",
            on_click=cargar_controles,
            bgcolor="#263238",
            color="white",
            height=40
        )

        hora_actual = ft.Text(
            ahora,
            size=vals["title_size"]*2,
            weight="bold",
            color="#263238"
        )

        cuerpo = ft.Column([
            ft.Row([
                ft.TextButton("←", on_click=self.mostrar_control_horarios),
                ft.Text(f"👤 {nombre_usuario}", size=12, color="grey")
            ], alignment="spaceBetween"),
            ft.Container(
                content=ft.Column([
                    ft.Text("ASISTENCIA", size=vals["title_size"], weight="bold"),
                    ft.Row([dd_vehiculo, btn_cargar], alignment="spaceBetween"),
                    ft.Divider(height=20),
                    hora_actual,
                    zona_botones,
                    info_text
                ], horizontal_alignment="center"),
                padding=vals["padding"],
                bgcolor="white",
                border_radius=12,
            )
        ], spacing=10)

        self.page.add(self.zona_segura(cuerpo))
        self.page.update()

    def registrar_marca(self, tipo, placa):
        """Registra marca con GPS"""
        nombre_usuario = self.sesion.get("usuario", "Administrador")
        lat, lon = self.obtener_gps()
        
        if self.db.registrar_asistencia_db(nombre_usuario, tipo, placa, lat, lon):
            self.page.snack_bar = ft.SnackBar(
                content=ft.Text(f"✅ {tipo.upper()} registrada"),
                bgcolor="#1B5E20",
                duration=1500
            )
            self.page.snack_bar.open = True
            self.vista_marcacion_asistencia()
        else:
            self.page.snack_bar = ft.SnackBar(
                content=ft.Text("❌ Error"),
                bgcolor="#B71C1C",
                duration=2000
            )
            self.page.snack_bar.open = True
            self.page.update()

    # ==========================================================
    # 2. PLANEACIÓN ADMINISTRATIVA RESPONSIVE
    # ==========================================================
    def vista_planeacion_admin(self, e=None):
        """Vista de planeación responsive"""
        self.page.clean()
        vals = self.get_responsive_values()
        
        vehiculos = self.db.obtener_lista_vehiculos()
        personal = self.db.obtener_lista_personal()

        dd_vehiculo = ft.Dropdown(
            label="Vehículo", 
            options=[ft.dropdown.Option(v[1]) for v in vehiculos] if vehiculos else [ft.dropdown.Option("Sin vehículos")], 
            border_radius=8,
            expand=True,
            dense=True
        )
        
        # Horarios responsive
        tf_hora_inicio = ft.TextField(
            label="Inicio", 
            value="08:00", 
            width=70,
            text_size=13,
            border_radius=6,
            text_align=ft.TextAlign.CENTER,
            dense=True
        )
        dd_am_pm_ini = ft.Dropdown(
            options=[ft.dropdown.Option("AM"), ft.dropdown.Option("PM")], 
            value="AM", 
            width=60,
            border_radius=6,
            dense=True
        )
        
        tf_hora_fin = ft.TextField(
            label="Fin", 
            value="06:00", 
            width=70,
            text_size=13,
            border_radius=6,
            text_align=ft.TextAlign.CENTER,
            dense=True
        )
        dd_am_pm_fin = ft.Dropdown(
            options=[ft.dropdown.Option("AM"), ft.dropdown.Option("PM")], 
            value="PM", 
            width=60,
            border_radius=6,
            dense=True
        )
        
        def crear_fila_horarios():
            """Fila de horarios responsive"""
            if self.page.width < 500:
                return ft.Column([
                    ft.Row([tf_hora_inicio, dd_am_pm_ini], alignment=ft.MainAxisAlignment.CENTER),
                    ft.Text("→", size=14),
                    ft.Row([tf_hora_fin, dd_am_pm_fin], alignment=ft.MainAxisAlignment.CENTER),
                ], horizontal_alignment="center", spacing=5)
            else:
                return ft.Row([
                    tf_hora_inicio, dd_am_pm_ini,
                    ft.Text("→", size=14),
                    tf_hora_fin, dd_am_pm_fin,
                ], alignment=ft.MainAxisAlignment.START, spacing=5)
        
        lista_empleados = ft.Column(spacing=5)
        
        def agregar_empleado(e):
            dd_emp = ft.Dropdown(
                options=[ft.dropdown.Option(p[0]) for p in personal] if personal else [ft.dropdown.Option("Sin personal")],
                border_radius=8,
                expand=True,
                dense=True
            )
            btn_borrar = ft.IconButton(
                icon=ft.icons.DELETE_OUTLINE,
                icon_color="red",
                icon_size=18,
                width=36,
                on_click=lambda _: eliminar_fila(fila)
            )
            fila = ft.Row([dd_emp, btn_borrar], spacing=5)
            lista_empleados.controls.append(fila)
            self.page.update()
        
        def eliminar_fila(fila):
            lista_empleados.controls.remove(fila)
            self.page.update()
        
        if personal:
            agregar_empleado(None)
        else:
            lista_empleados.controls.append(
                ft.Text("⚠️ No hay empleados", color="orange", size=11, italic=True)
            )
        
        def guardar_plan(e):
            if not dd_vehiculo.value or dd_vehiculo.value == "Sin vehículos":
                self.page.snack_bar = ft.SnackBar(content=ft.Text("❌ Selecciona vehículo"), bgcolor="#B71C1C")
                self.page.snack_bar.open = True
                self.page.update()
                return
            
            empleados = []
            for fila in lista_empleados.controls:
                if isinstance(fila, ft.Row) and fila.controls:
                    dd = fila.controls[0]
                    if dd.value and dd.value != "Sin personal":
                        empleados.append(dd.value)
            
            if not empleados:
                self.page.snack_bar = ft.SnackBar(content=ft.Text("❌ Selecciona empleado"), bgcolor="#B71C1C")
                self.page.snack_bar.open = True
                self.page.update()
                return
            
            h_inicio = f"{tf_hora_inicio.value} {dd_am_pm_ini.value}"
            h_fin = f"{tf_hora_fin.value} {dd_am_pm_fin.value}"
            fecha = datetime.now().strftime("%Y-%m-%d")
            
            if self.db.guardar_plan_ruta(fecha, dd_vehiculo.value, empleados, h_inicio, h_fin):
                self.page.snack_bar = ft.SnackBar(content=ft.Text("✅ Plan guardado"), bgcolor="#1B5E20")
                self.page.snack_bar.open = True
                self.mostrar_control_horarios()
            else:
                self.page.snack_bar = ft.SnackBar(content=ft.Text("❌ Error"), bgcolor="#B71C1C")
                self.page.snack_bar.open = True
                self.page.update()
        
        cuerpo = ft.Column([
            ft.Row([
                ft.TextButton("←", on_click=self.mostrar_control_horarios),
            ], alignment="spaceBetween"),
            ft.Text("PLANEACIÓN", size=vals["title_size"], weight="bold"),
            ft.Container(
                content=ft.Column([
                    ft.Container(
                        content=ft.Column([
                            ft.Text("1. Vehículo", size=12, weight="bold", color="#1565C0"),
                            dd_vehiculo,
                        ]),
                        padding=10
                    ),
                    ft.Divider(height=1),
                    ft.Container(
                        content=ft.Column([
                            ft.Text("2. Horario", size=12, weight="bold", color="#1565C0"),
                            crear_fila_horarios(),
                        ]),
                        padding=10
                    ),
                    ft.Divider(height=1),
                    ft.Container(
                        content=ft.Column([
                            ft.Row([
                                ft.Text("3. Equipo", size=12, weight="bold", color="#1565C0"),
                                ft.ElevatedButton("+", on_click=agregar_empleado, bgcolor="#263238", color="white", width=40, height=30),
                            ], alignment="spaceBetween"),
                            lista_empleados,
                        ]),
                        padding=10
                    ),
                    ft.Container(height=10),
                    ft.ElevatedButton(
                        "GUARDAR",
                        on_click=guardar_plan,
                        bgcolor="black",
                        color="white",
                        height=40,
                    )
                ]),
                padding=15,
                bgcolor="white",
                border_radius=10,
                border=ft.border.all(1, "#E0E0E0")
            )
        ], spacing=10)
        
        self.page.add(self.zona_segura(cuerpo))
        self.page.update()

    # ==========================================================
    # 3. MONITOR DE RUTAS RESPONSIVE
    # ==========================================================
    def vista_ruta_diaria(self, e=None, f_fecha=None, f_placa="Todos", f_empleado="Todos"):
        """Vista de rutas responsive"""
        self.page.clean()
        vals = self.get_responsive_values()
        
        fecha_consulta = f_fecha if f_fecha else datetime.now().strftime("%Y-%m-%d")
        
        p_sql = None if f_placa == "Todos" or not f_placa else f_placa
        e_sql = None if f_empleado == "Todos" or not f_empleado else f_empleado
        
        rutas_dia = self.db.obtener_rutas_filtradas(fecha=fecha_consulta, placa=p_sql, empleado=e_sql)

        vehiculos = self.db.obtener_lista_vehiculos()
        personal = self.db.obtener_lista_personal()

        dd_placa = ft.Dropdown(
            label="Vehículo",
            options=[ft.dropdown.Option("Todos")] + [ft.dropdown.Option(v[1]) for v in vehiculos],
            value=f_placa,
            border_radius=8,
            dense=True,
            expand=True
        )
        
        dd_empleado = ft.Dropdown(
            label="Empleado",
            options=[ft.dropdown.Option("Todos")] + [ft.dropdown.Option(p[0]) for p in personal],
            value=f_empleado,
            border_radius=8,
            dense=True,
            expand=True
        )

        datepicker = ft.DatePicker(
            on_change=lambda e: self.vista_ruta_diaria(
                f_fecha=e.control.value.strftime("%Y-%m-%d"), 
                f_placa=dd_placa.value, 
                f_empleado=dd_empleado.value
            )
        )
        self.page.overlay.append(datepicker)

        barra_filtros = ft.Container(
            content=ft.Column([
                ft.Row([
                    ft.TextButton(
                        content=ft.Row([
                            ft.Icon(ft.icons.CALENDAR_TODAY, size=14),
                            ft.Text(fecha_consulta, size=12),
                        ]),
                        on_click=lambda _: setattr(datepicker, "open", True) or self.page.update()
                    ),
                ], alignment="spaceBetween"),
                ft.Row([dd_placa, dd_empleado], spacing=5),
                ft.ElevatedButton(
                    "FILTRAR",
                    on_click=lambda _: self.vista_ruta_diaria(fecha_consulta, dd_placa.value, dd_empleado.value),
                    bgcolor="black",
                    color="white",
                    height=35,
                )
            ]),
            padding=12,
            bgcolor="white",
            border_radius=8
        )

        tarjetas = ft.Column(spacing=8)
        
        for ruta in rutas_dia:
            empleados_col = ft.Column(spacing=3)
            
            for emp in ruta["equipo"]:
                marcas = self.db.obtener_marcas_por_vehiculo(emp, ruta["placa"])
                ultima = self.db.obtener_ultima_marca_por_vehiculo(emp, ruta["placa"])
                
                if ultima == "entrada":
                    icono, color = "🚀", "#1B5E20"
                elif ultima == "almuerzo":
                    icono, color = "🍴", "#E65100"
                elif ultima == "regreso":
                    icono, color = "🏢", "#01579B"
                elif ultima == "salida":
                    icono, color = "🏠", "#455A64"
                else:
                    icono, color = "💤", "#9E9E9E"
                
                emp_row = ft.Container(
                    content=ft.Row([
                        ft.Row([
                            ft.Text(icono, size=14),
                            ft.Text(emp, weight="bold", size=12),
                        ]),
                        ft.Container(
                            content=ft.Text(marcas.get("entrada", "--")[:5], size=10),
                            padding=2
                        ),
                    ], alignment="spaceBetween"),
                    padding=6,
                    bgcolor="#F5F5F5",
                    border_radius=6
                )
                empleados_col.controls.append(emp_row)
            
            tarjeta = ft.Container(
                content=ft.Column([
                    ft.Row([
                        ft.Text("🚚", size=16),
                        ft.Text(ruta["placa"], weight="bold", size=14),
                        ft.Text(f"{len(ruta['equipo'])}", size=10, color="white"),
                    ], alignment="spaceBetween"),
                    ft.Divider(height=1),
                    empleados_col
                ]),
                padding=12,
                bgcolor="white",
                border_radius=8,
                border=ft.border.all(1, "#E0E0E0")
            )
            tarjetas.controls.append(tarjeta)
        
        if not rutas_dia:
            tarjetas.controls.append(
                ft.Container(
                    content=ft.Column([
                        ft.Text("📭", size=30),
                        ft.Text("Sin rutas", size=13, color="grey"),
                    ], horizontal_alignment="center"),
                    padding=20,
                    bgcolor="white",
                    border_radius=8
                )
            )

        cuerpo = ft.Column([
            ft.Row([
                ft.TextButton("←", on_click=self.mostrar_control_horarios),
                ft.Text(f"{len(rutas_dia)} rutas", size=11, color="grey")
            ], alignment="spaceBetween"),
            ft.Text("RUTAS", size=vals["title_size"], weight="bold"),
            barra_filtros,
            tarjetas
        ], scroll=ft.ScrollMode.AUTO)
        
        self.page.add(self.zona_segura(cuerpo))
        self.page.update()