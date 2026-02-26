import flet as ft
from datetime import datetime
import json

class HorariosModule:
    """
    ⏱️ MÓDULO DE CONTROL HORARIO
    Gestión de asistencia, rutas diarias y planeación de personal
    """
    
    def __init__(self, page, db, sesion, volver_callback):
        self.page = page
        self.db = db
        self.sesion = sesion
        self.volver_callback = volver_callback

    def zona_segura(self, contenido, col_size={"sm": 12, "md": 11, "lg": 10}):
        """Aplica márgenes consistentes al contenido"""
        return ft.ResponsiveRow([
            ft.Column([
                ft.Container(
                    content=contenido,
                    padding=ft.padding.only(left=20, right=20, top=10, bottom=20)
                )
            ], col=col_size)
        ], alignment="center")

    def mostrar_control_horarios(self, e=None):
        """Menú principal del módulo"""
        self.page.clean()
        header = ft.Row([
            ft.TextButton("← VOLVER", on_click=lambda _: self.volver_callback(self.sesion["usuario"])),
            ft.Text("TIEMPOS Y PLANEACIÓN", size=20, weight="bold"),
        ], alignment="spaceBetween")

        menu_grid = ft.ResponsiveRow(spacing=15, run_spacing=15)
        
        menu_grid.controls.append(
            self.crear_tarjeta_menu("MI ASISTENCIA", "⏱️", "Registrar entrada, almuerzo o salida", self.vista_marcacion_asistencia)
        )
        menu_grid.controls.append(
            self.crear_tarjeta_menu("RUTAS DEL DIA", "🚚", "Ver vehículo y equipo asignado", self.vista_ruta_diaria)
        )
        menu_grid.controls.append(
            self.crear_tarjeta_menu("PLANEACIÓN PRO", "📅", "Asignar personal a vehículos y fechas", self.vista_planeacion_admin)
        )

        contenido = ft.Column([
            ft.Container(height=10),
            header,
            ft.Container(height=20),
            ft.Text("GESTIÓN OPERATIVA", size=12, weight="bold", color="grey"),
            menu_grid,
        ], scroll="auto")

        self.page.add(self.zona_segura(contenido))
        self.page.update()

    def crear_tarjeta_menu(self, titulo, emoji, subtitulo, accion):
        """Crea tarjetas de menú consistentes"""
        return ft.Container(
            content=ft.Row([
                ft.Text(emoji, size=30),
                ft.Column([
                    ft.Text(titulo, weight="bold", size=16),
                    ft.Text(subtitulo, size=12, color="grey"),
                ], expand=True, spacing=1)
            ]),
            padding=20, bgcolor="white", border_radius=15, border=ft.border.all(1, "#E0E0E0"),
            on_click=lambda _: accion(), col={"sm": 12, "md": 6, "lg": 4}
        )

    # ==========================================================
    # 1. ASISTENCIA (VERSIÓN CORREGIDA Y FUNCIONAL)
    # ==========================================================
    def vista_marcacion_asistencia(self, e=None):
        """Vista para registrar marcas de asistencia por vehículo"""
        self.page.clean()
        ahora = datetime.now().strftime("%I:%M %p")
        
        # Obtener nombre de usuario de la sesión
        nombre_usuario = self.sesion.get("usuario", "Administrador")
        print(f"🎯 Usuario para búsqueda: '{nombre_usuario}'")
        
        # Obtener rutas asignadas
        mis_rutas = self.db.obtener_planes_empleado(nombre_usuario)
        print(f"📋 Rutas encontradas: {len(mis_rutas)}")
        
        # Crear dropdown con vehículos
        if mis_rutas:
            opciones_vehiculo = [ft.dropdown.Option(r["placa"]) for r in mis_rutas]
            hint_text = "Selecciona tu vehículo"
        else:
            opciones_vehiculo = [ft.dropdown.Option("SIN_VEHICULOS", "⚠️ Sin vehículos asignados")]
            hint_text = "No hay vehículos disponibles"
        
        dd_vehiculo = ft.Dropdown(
            label="Vehículo asignado",
            options=opciones_vehiculo,
            hint_text=hint_text,
            expand=True,
            border_radius=10
        )

        # Contenedor para botones de marcación
        zona_botones = ft.Column()
        info_text = ft.Text("", size=12, color="grey", italic=True)

        def cargar_controles_vehiculo(e):
            """Carga los botones según vehículo seleccionado"""
            if not dd_vehiculo.value or dd_vehiculo.value == "SIN_VEHICULOS":
                info_text.value = "❌ No tienes vehículos asignados para hoy"
                self.page.update()
                return

            placa = dd_vehiculo.value
            print(f"🔄 Cargando controles para: {placa}")
            
            # Obtener marcas existentes
            marcas = self.db.obtener_marcas_por_vehiculo(nombre_usuario, placa)
            ultima = self.db.obtener_ultima_marca_por_vehiculo(nombre_usuario, placa)
            
            print(f"📊 Marcas: {marcas}")
            print(f"📌 Última: {ultima}")

            def determinar_estado(tipo):
                """Determina si un botón debe estar habilitado"""
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
                """Crea botón de marcación"""
                habilitado = determinar_estado(tipo_m)
                hora_m = marcas.get(tipo_m, "--:--")
                
                # Color según estado
                if hora_m != "--:--":
                    bg_color = "#455A64"  # Gris oscuro (ya marcado)
                elif habilitado:
                    bg_color = color  # Color completo (siguiente paso)
                else:
                    bg_color = "#B0BEC5"  # Gris claro (no disponible)
                
                return ft.Container(
                    content=ft.Column([
                        ft.Text(emoji, size=24),
                        ft.Text(texto, size=10, weight="bold", color="white"),
                        ft.Text(hora_m, size=9, color="white70"),
                    ], horizontal_alignment="center", spacing=2),
                    bgcolor=bg_color,
                    width=85,
                    height=85,
                    border_radius=12,
                    padding=8,
                    on_click=lambda _, t=tipo_m, p=placa: self.registrar_marca(t, p) if habilitado else None,
                )

            # Actualizar botones
            zona_botones.controls = [
                ft.Row([
                    crear_boton("ENTRADA", "🚀", "#1B5E20", "entrada"),
                    crear_boton("ALMUERZO", "🍴", "#E65100", "almuerzo"),
                    crear_boton("REGRESO", "🏢", "#01579B", "regreso"),
                    crear_boton("SALIDA", "🏠", "#B71C1C", "salida"),
                ], alignment=ft.MainAxisAlignment.CENTER, spacing=10)
            ]
            
            # Mensaje informativo
            if not ultima:
                info_text.value = "👇 Marca ENTRADA para comenzar tu jornada"
            elif ultima == "salida":
                info_text.value = "✅ Jornada completada. ¡Buen trabajo!"
            elif ultima:
                info_text.value = f"👉 Siguiente paso disponible"
            
            self.page.update()

        # Botón cargar
        btn_cargar = ft.ElevatedButton(
            "CARGAR VEHÍCULO",
            on_click=cargar_controles_vehiculo,
            bgcolor="#263238",
            color="white",
            height=45
        )

        # Hora actual
        hora_actual = ft.Text(
            datetime.now().strftime("%I:%M %p"),
            size=48,
            weight="bold",
            color="#263238"
        )

        # Construir UI
        cuerpo = ft.Column([
            ft.Row([
                ft.TextButton("← VOLVER", on_click=self.mostrar_control_horarios),
                ft.Text(f"👤 {nombre_usuario}", size=14, color="grey")
            ], alignment="spaceBetween"),
            ft.Container(
                content=ft.Column([
                    ft.Text("MARCACIÓN DE ASISTENCIA", size=20, weight="bold"),
                    ft.Container(height=10),
                    ft.Row([dd_vehiculo, btn_cargar], alignment="spaceBetween"),
                    ft.Divider(height=30),
                    hora_actual,
                    ft.Container(height=20),
                    zona_botones,
                    info_text
                ], horizontal_alignment="center"),
                padding=30,
                bgcolor="white",
                border_radius=20,
                shadow=ft.BoxShadow(blur_radius=10, color="#20000000")
            )
        ], spacing=10)

        self.page.add(self.zona_segura(cuerpo))
        self.page.update()

    def registrar_marca(self, tipo, placa):
        """Registra una marca y actualiza la vista - VERSIÓN CORREGIDA"""
        nombre_usuario = self.sesion.get("usuario", "Administrador")
        
        print(f"📝 Registrando {tipo} para {nombre_usuario} en {placa}")
        
        if self.db.registrar_asistencia_db(nombre_usuario, tipo, placa):
            self.page.snack_bar = ft.SnackBar(
                content=ft.Text(f"✅ {tipo.upper()} registrada"),
                bgcolor="#1B5E20",
                duration=1500
            )
            self.page.snack_bar.open = True
            # Recargar vista para mostrar cambios
            self.vista_marcacion_asistencia()
        else:
            self.page.snack_bar = ft.SnackBar(
                content=ft.Text("❌ Error al registrar"),
                bgcolor="#B71C1C",
                duration=2000
            )
            self.page.snack_bar.open = True
            self.page.update()

    # ==========================================================
    # 2. PLANEACIÓN ADMINISTRATIVA
    # ==========================================================
    def vista_planeacion_admin(self, e=None):
        """Vista para planificar rutas y personal - VERSIÓN CORREGIDA SIN HEIGHT"""
        self.page.clean()
        self.page.scroll = ft.ScrollMode.ADAPTIVE
        
        vehiculos = self.db.obtener_lista_vehiculos()
        personal = self.db.obtener_lista_personal()

        # Dropdown de vehículo con ancho completo
        dd_vehiculo = ft.Dropdown(
            label="Vehículo", 
            options=[ft.dropdown.Option(v[1]) for v in vehiculos] if vehiculos else [ft.dropdown.Option("Sin vehículos")], 
            border_radius=10,
            expand=True
        )
        
        # Horarios - SIN HEIGHT
        tf_hora_inicio = ft.TextField(
            label="Inicio", 
            value="08:00", 
            width=80,
            text_size=14,
            border_radius=8,
            text_align=ft.TextAlign.CENTER,
            dense=True
        )
        dd_am_pm_ini = ft.Dropdown(
            options=[ft.dropdown.Option("AM"), ft.dropdown.Option("PM")], 
            value="AM", 
            width=70,
            border_radius=8,
            dense=True
        )
        
        tf_hora_fin = ft.TextField(
            label="Fin", 
            value="06:00", 
            width=80,
            text_size=14,
            border_radius=8,
            text_align=ft.TextAlign.CENTER,
            dense=True
        )
        dd_am_pm_fin = ft.Dropdown(
            options=[ft.dropdown.Option("AM"), ft.dropdown.Option("PM")], 
            value="PM", 
            width=70,
            border_radius=8,
            dense=True
        )
        
        # Lista de empleados
        lista_empleados = ft.Column(spacing=8)
        
        def agregar_empleado(e):
            """Añade una fila para seleccionar un empleado"""
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
                width=40,
                on_click=lambda _: eliminar_fila(fila)
            )
            
            fila = ft.Row([dd_emp, btn_borrar], spacing=5, vertical_alignment=ft.CrossAxisAlignment.CENTER)
            lista_empleados.controls.append(fila)
            self.page.update()
        
        def eliminar_fila(fila):
            lista_empleados.controls.remove(fila)
            self.page.update()
        
        # Agregar primera fila si hay personal
        if personal:
            agregar_empleado(None)
        else:
            # Mostrar mensaje si no hay personal
            lista_empleados.controls.append(
                ft.Text("⚠️ No hay empleados registrados", color="orange", italic=True)
            )
        
        def guardar_plan(e):
            """Guarda el plan en la base de datos"""
            if not dd_vehiculo.value or dd_vehiculo.value == "Sin vehículos":
                self.page.snack_bar = ft.SnackBar(content=ft.Text("❌ Selecciona un vehículo"), bgcolor="#B71C1C")
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
                self.page.snack_bar = ft.SnackBar(content=ft.Text("❌ Selecciona al menos un empleado"), bgcolor="#B71C1C")
                self.page.snack_bar.open = True
                self.page.update()
                return
            
            h_inicio = f"{tf_hora_inicio.value} {dd_am_pm_ini.value}"
            h_fin = f"{tf_hora_fin.value} {dd_am_pm_fin.value}"
            fecha = datetime.now().strftime("%Y-%m-%d")
            
            print(f"💾 Guardando plan: {fecha} - {dd_vehiculo.value} - {empleados} - {h_inicio} a {h_fin}")
            
            if self.db.guardar_plan_ruta(fecha, dd_vehiculo.value, empleados, h_inicio, h_fin):
                self.page.snack_bar = ft.SnackBar(content=ft.Text("✅ Plan guardado"), bgcolor="#1B5E20")
                self.page.snack_bar.open = True
                # Pequeño delay antes de volver
                import time
                time.sleep(0.5)
                self.mostrar_control_horarios()
            else:
                self.page.snack_bar = ft.SnackBar(content=ft.Text("❌ Error al guardar"), bgcolor="#B71C1C")
                self.page.snack_bar.open = True
                self.page.update()
        
        # CONSTRUCCIÓN DE UI
        cuerpo = ft.Column([
            ft.Row([
                ft.TextButton("← VOLVER", on_click=self.mostrar_control_horarios),
            ], alignment="spaceBetween"),
            
            ft.Text("PLANEACIÓN DE RUTA", size=22, weight="bold"),
            ft.Container(height=10),
            
            ft.Container(
                content=ft.Column([
                    # 1. Vehículo
                    ft.Container(
                        content=ft.Column([
                            ft.Text("1. Datos del vehículo", weight="bold", color="#1565C0"),
                            dd_vehiculo,
                        ]),
                        padding=10
                    ),
                    
                    ft.Divider(height=1),
                    
                    # 2. Horario - EN UNA SOLA FILA
                    ft.Container(
                        content=ft.Column([
                            ft.Text("2. Horario de jornada", weight="bold", color="#1565C0"),
                            ft.Container(height=5),
                            ft.Row([
                                tf_hora_inicio,
                                dd_am_pm_ini,
                                ft.Text("→", size=16),
                                tf_hora_fin,
                                dd_am_pm_fin,
                            ], alignment=ft.MainAxisAlignment.START, spacing=5)
                        ]),
                        padding=10
                    ),
                    
                    ft.Divider(height=1),
                    
                    # 3. Equipo
                    ft.Container(
                        content=ft.Column([
                            ft.Row([
                                ft.Text("3. Equipo de trabajo", weight="bold", color="#1565C0"),
                                ft.ElevatedButton(
                                    "+ Agregar",
                                    on_click=agregar_empleado,
                                    bgcolor="#263238",
                                    color="white",
                                    height=35,
                                    width=100
                                ),
                            ], alignment="spaceBetween"),
                            ft.Container(height=10),
                            lista_empleados,
                        ]),
                        padding=10
                    ),
                    
                    ft.Container(height=20),
                    
                    # Botón guardar
                    ft.ElevatedButton(
                        "GUARDAR PLAN",
                        on_click=guardar_plan,
                        bgcolor="black",
                        color="white",
                        height=45,
                    )
                ]),
                padding=15,
                bgcolor="white",
                border_radius=12,
                border=ft.border.all(1, "#E0E0E0")
            )
        ], spacing=10)
        
        self.page.add(self.zona_segura(cuerpo, col_size={"sm": 12, "md": 10, "lg": 8}))
        self.page.update()

    # ==========================================================
    # 3. MONITOR DE RUTAS
    # ==========================================================
    def vista_ruta_diaria(self, e=None, f_fecha=None, f_placa="Todos", f_empleado="Todos"):
        """
        Vista de monitor con diseño de rejilla profesional
        Las tarjetas se organizan en columnas según el espacio disponible
        """
        self.page.clean()
        self.page.scroll = ft.ScrollMode.ADAPTIVE
        
        fecha_consulta = f_fecha if f_fecha else datetime.now().strftime("%Y-%m-%d")
        
        # Filtros
        p_sql = None if f_placa == "Todos" or not f_placa else f_placa
        e_sql = None if f_empleado == "Todos" or not f_empleado else f_empleado
        
        rutas_dia = self.db.obtener_rutas_filtradas(fecha=fecha_consulta, placa=p_sql, empleado=e_sql)

        # Datos para filtros
        vehiculos = self.db.obtener_lista_vehiculos()
        personal = self.db.obtener_lista_personal()

        # Dropdowns para filtros
        dd_placa = ft.Dropdown(
            label="Vehículo",
            options=[ft.dropdown.Option("Todos")] + [ft.dropdown.Option(v[1]) for v in vehiculos],
            value=f_placa,
            border_radius=8,
            dense=True
        )
        
        dd_empleado = ft.Dropdown(
            label="Empleado",
            options=[ft.dropdown.Option("Todos")] + [ft.dropdown.Option(p[0]) for p in personal],
            value=f_empleado,
            border_radius=8,
            dense=True
        )

        # DatePicker
        datepicker = ft.DatePicker(
            on_change=lambda e: self.vista_ruta_diaria(
                f_fecha=e.control.value.strftime("%Y-%m-%d"), 
                f_placa=dd_placa.value, 
                f_empleado=dd_empleado.value
            )
        )
        self.page.overlay.append(datepicker)

        # BARRA DE FILTROS PROFESIONAL
        barra_filtros = ft.Container(
            content=ft.ResponsiveRow([
                ft.Container(
                    content=ft.Column([
                        ft.Text("📅 FECHA", size=10, weight="bold", color="grey"),
                        ft.TextButton(
                            content=ft.Row([
                                ft.Text(fecha_consulta, size=14, weight="bold"),
                                ft.Icon(ft.icons.ARROW_DROP_DOWN, size=16),
                            ], spacing=2),
                            on_click=lambda _: setattr(datepicker, "open", True) or self.page.update(),
                            style=ft.ButtonStyle(color="black", bgcolor="white"),
                        )
                    ]),
                    col={"xs": 6, "sm": 3, "md": 2, "lg": 2}
                ),
                ft.Container(
                    content=dd_placa,
                    col={"xs": 6, "sm": 4, "md": 3, "lg": 3}
                ),
                ft.Container(
                    content=dd_empleado,
                    col={"xs": 6, "sm": 4, "md": 3, "lg": 3}
                ),
                ft.Container(
                    content=ft.Row([
                        ft.ElevatedButton(
                            "Filtrar",
                            icon=ft.icons.SEARCH,
                            on_click=lambda _: self.vista_ruta_diaria(
                                fecha_consulta, 
                                dd_placa.value, 
                                dd_empleado.value
                            ),
                            bgcolor="black",
                            color="white",
                            height=40,
                            expand=True
                        ),
                        ft.IconButton(
                            icon=ft.icons.REFRESH,
                            icon_size=20,
                            tooltip="Actualizar",
                            on_click=lambda _: self.vista_ruta_diaria(
                                fecha_consulta, 
                                dd_placa.value, 
                                dd_empleado.value
                            ),
                            style=ft.ButtonStyle(bgcolor="#F0F0F0")
                        ),
                    ], spacing=5),
                    col={"xs": 12, "sm": 12, "md": 4, "lg": 4}
                )
            ], spacing=10),
            padding=15,
            bgcolor="white",
            border_radius=12,
            border=ft.border.all(1, "#E0E0E0"),
            margin=ft.margin.only(bottom=15)
        )

        # CONTADOR DE RESULTADOS
        contador = ft.Container(
            content=ft.Row([
                ft.Text(f"📋 {len(rutas_dia)} rutas encontradas", size=12, color="grey"),
                ft.Container(
                    content=ft.Text(f"Última actualización: {datetime.now().strftime('%H:%M')}", 
                                size=10, color="grey", italic=True),
                    padding=ft.padding.only(right=5)
                )
            ], alignment="spaceBetween"),
            margin=ft.margin.only(bottom=10)
        )

        # TARJETAS EN REJILLA PROFESIONAL
        if rutas_dia:
            # Grid responsivo: 1 col móvil, 2 tablet, 3 desktop, 4 pantallas grandes
            grid = ft.ResponsiveRow(spacing=10, run_spacing=10)
            
            for ruta in rutas_dia:
                # Construir lista de empleados para esta ruta
                empleados_col = ft.Column(spacing=4)
                
                for emp in ruta["equipo"]:
                    marcas = self.db.obtener_marcas_por_vehiculo(emp, ruta["placa"])
                    ultima = self.db.obtener_ultima_marca_por_vehiculo(emp, ruta["placa"])
                    
                    # Determinar estado
                    if ultima == "entrada":
                        icono, color, texto = "🚀", "#1B5E20", "En ruta"
                    elif ultima == "almuerzo":
                        icono, color, texto = "🍴", "#E65100", "Almuerzo"
                    elif ultima == "regreso":
                        icono, color, texto = "🏢", "#01579B", "Regreso"
                    elif ultima == "salida":
                        icono, color, texto = "🏠", "#455A64", "Finalizó"
                    else:
                        icono, color, texto = "💤", "#9E9E9E", "Pendiente"
                    
                    # Obtener hora de entrada si existe
                    hora_entrada = marcas.get("entrada", "--")[:5] if "entrada" in marcas else "--"
                    
                    # Fila de empleado ultra compacta
                    emp_row = ft.Container(
                        content=ft.Row([
                            ft.Text(icono, size=12, width=18),
                            ft.Text(emp.split()[0] if " " in emp else emp, size=11, weight="bold"),  # Primer nombre
                            ft.Container(
                                content=ft.Text(texto[:3].upper(), size=8, color="white", weight="bold"),
                                bgcolor=color,
                                padding=ft.padding.only(left=4, right=4, top=1, bottom=1),
                                border_radius=4,
                                height=16,
                                alignment=ft.alignment.center
                            ),
                            ft.Text(hora_entrada, size=9, color="black"),
                        ], spacing=4, alignment="spaceBetween"),
                        padding=2,
                    )
                    empleados_col.controls.append(emp_row)
                
                # Tarjeta de ruta - TAMAÑO FIJO EN PC GRANDE
                tarjeta = ft.Container(
                    content=ft.Column([
                        # Header con placa y contador
                        ft.Container(
                            content=ft.Row([
                                ft.Row([
                                    ft.Text("🚚", size=14),
                                    ft.Text(ruta["placa"], weight="bold", size=14),
                                ], spacing=4),
                                ft.Container(
                                    content=ft.Text(str(len(ruta['equipo'])), size=10, color="white", weight="bold"),
                                    bgcolor="#263238",
                                    width=20,
                                    height=20,
                                    alignment=ft.alignment.center,
                                    border_radius=10
                                )
                            ], alignment="spaceBetween"),
                            padding=ft.padding.only(bottom=5)
                        ),
                        # Horario compacto
                        ft.Text(f"{ruta.get('h_inicio','--')[:5]} - {ruta.get('h_fin','--')[:5]}", 
                            size=9, color="grey", italic=True),
                        ft.Divider(height=5, color="#E0E0E0"),
                        # Lista empleados
                        empleados_col,
                    ], spacing=3),
                    padding=12,
                    bgcolor="white",
                    border_radius=10,
                    border=ft.border.all(1, "#E0E0E0"),
                    # TAMAÑO CONTROLADO EN REJILLA
                    col={"xs": 12, "sm": 6, "md": 4, "lg": 3, "xl": 2},
                    # ALTURA FIJA para uniformidad
                    height=180,
                )
                grid.controls.append(tarjeta)
            
            contenido_tarjetas = grid
        else:
            contenido_tarjetas = ft.Container(
                content=ft.Column([
                    ft.Text("📭", size=50),
                    ft.Text("No hay rutas programadas", size=14, color="grey"),
                    ft.ElevatedButton(
                        "Crear nueva ruta",
                        on_click=lambda _: self.vista_planeacion_admin(),
                        bgcolor="#263238",
                        color="white",
                        height=35
                    )
                ], horizontal_alignment="center", spacing=5),
                padding=40,
                bgcolor="white",
                border_radius=10
            )

        # CUERPO PRINCIPAL
        cuerpo = ft.Column([
            # Header con título
            ft.Container(
                content=ft.Row([
                    ft.Text("MONITOR DE OPERACIONES", size=20, weight="bold"),
                    ft.TextButton(
                        content=ft.Row([
                            ft.Icon(ft.icons.ARROW_BACK, size=16),  # ✅ CORREGIDO: cons → icons
                            ft.Text("Volver")
                        ]),
                        on_click=self.mostrar_control_horarios
                    )
                ], alignment="spaceBetween"),
                margin=ft.margin.only(bottom=5)
            ),
            barra_filtros,
            contador,
            ft.Container(
                content=contenido_tarjetas,
                expand=True
            )
        ], spacing=5, expand=True)
        
        self.page.add(self.zona_segura(cuerpo, col_size={"sm": 12, "md": 12, "lg": 12}))
        self.page.update()