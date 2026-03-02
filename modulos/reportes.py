# modulos/reportes.py
"""
📊 MÓDULO DE REPORTES - APEX ERP
Reportes profesionales con diseño empresarial
"""

import flet as ft
from datetime import datetime, timedelta
import json

class ReportesModule:
    """
    Clase principal del módulo de reportes
    """
    
    def __init__(self, page, db, sesion, volver_callback):
        self.page = page
        self.db = db
        self.sesion = sesion
        self.volver_callback = volver_callback
        self.resultados_container = None
    
    def zona_segura(self, contenido, col_size={"sm": 12, "md": 11, "lg": 10}):
        """Aplica márgenes consistentes al contenido"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        return ft.ResponsiveRow([
            ft.Column([
                ft.Container(
                    content=contenido,
                    padding=ft.padding.only(left=20, right=20, top=10, bottom=20)
                )
            ], col=col_size)
        ], alignment="center")
    
    def menu_reportes(self, e=None):
        """Menú principal de reportes"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        self.page.clean()
        
        header = ft.Row([
            ft.TextButton("← VOLVER", on_click=lambda _: self.volver_callback(self.sesion["usuario"])),
            ft.Text("CENTRO DE REPORTES", size=20, weight="bold"),
        ], alignment="spaceBetween")
        
        # Grid de opciones de reporte
        grid_reportes = ft.ResponsiveRow(spacing=15, run_spacing=15)
        
        opciones = [
            {
                "titulo": "CONTROL HORARIO",
                "desc": "Asistencia, rutas y tiempos por empleado/vehículo",
                "icono": "⏱️",
                "color": "#1B5E20",
                "accion": self.reporte_control_horario
            },
            {
                "titulo": "PRODUCTIVIDAD",
                "desc": "Rendimiento por técnico y servicios completados",
                "icono": "📈",
                "color": "#1565C0",
                "accion": self.reporte_no_disponible
            },
            {
                "titulo": "FLOTA",
                "desc": "Utilización de vehículos y consumo",
                "icono": "🚛",
                "color": "#FF8F00",
                "accion": self.reporte_no_disponible
            },
            {
                "titulo": "FINANCIERO",
                "desc": "Costos de nómina y facturación",
                "icono": "💰",
                "color": "#C62828",
                "accion": self.reporte_no_disponible
            }
        ]
        
        for op in opciones:
            grid_reportes.controls.append(
                ft.Container(
                    content=ft.Column([
                        ft.Text(op["icono"], size=40),
                        ft.Text(op["titulo"], weight="bold", size=16),
                        ft.Text(op["desc"], size=11, color="grey", text_align="center"),
                    ], horizontal_alignment="center", spacing=5),
                    padding=25,
                    bgcolor="white",
                    border_radius=15,
                    border=ft.border.all(1, "#E0E0E0"),
                    on_click=lambda _, a=op["accion"]: a(),
                    col={"xs": 12, "sm": 6, "md": 4, "lg": 3}
                )
            )
        
        cuerpo = ft.Column([
            header,
            ft.Container(height=20),
            ft.Text("SELECCIONE TIPO DE REPORTE", size=12, weight="bold", color="grey"),
            grid_reportes,
        ], scroll="auto")
        
        self.page.add(self.zona_segura(cuerpo))
        self.page.update()
    
    def reporte_no_disponible(self, e=None):
        """Muestra mensaje de reporte no disponible"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        self.page.snack_bar = ft.SnackBar(
            content=ft.Text("📋 Reporte en desarrollo - Próximamente disponible"),
            bgcolor="#E65100"
        )
        self.page.snack_bar.open = True
        self.page.update()
    
    def reporte_control_horario(self, e=None):
        """Reporte de control horario con diseño profesional y responsive"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        self.page.clean()
        self.page.scroll = ft.ScrollMode.ADAPTIVE
        self.page.bgcolor = "#F8F9FA"
        self.page.padding = 0
        self.page.spacing = 0
        
        # Fechas por defecto
        fecha_fin = datetime.now()
        fecha_inicio = fecha_fin - timedelta(days=7)
        
        fecha_inicio_str = fecha_inicio.strftime("%Y-%m-%d")
        fecha_fin_str = fecha_fin.strftime("%Y-%m-%d")
        
        # Obtener datos
        vehiculos = self.db.obtener_lista_vehiculos()
        personal = self.db.obtener_lista_personal()
        
        # ==========================================================
        # HEADER CON TÍTULO Y ACCIONES (RESPONSIVE)
        # ==========================================================
        header = ft.Container(
            content=ft.ResponsiveRow([
                ft.Container(
                    content=ft.Row([
                        ft.IconButton(
                            icon=ft.icons.ARROW_BACK,
                            icon_color="#1E3A5F",
                            on_click=self.menu_reportes,
                            tooltip="Volver al centro de reportes"
                        ),
                        ft.Column([
                            ft.Text(
                                "REPORTE DE CONTROL HORARIO", 
                                size=18, 
                                weight=ft.FontWeight.BOLD,
                                color="#1E3A5F"
                            ),
                            ft.Text(
                                "Análisis de asistencia y productividad", 
                                size=11, 
                                color="grey600"
                            ),
                        ], spacing=2)
                    ]),
                    col={"xs": 12, "sm": 8, "md": 8, "lg": 8}
                ),
                ft.Container(
                    content=ft.Row([
                        ft.OutlinedButton(
                            "EXCEL",
                            icon=ft.icons.DOWNLOAD,
                            on_click=self.reporte_no_disponible,
                            style=ft.ButtonStyle(
                                color="#1E3A5F",
                                side=ft.BorderSide(1, "#1E3A5F"),
                                shape=ft.RoundedRectangleBorder(radius=8)
                            ),
                            height=40
                        ),
                        ft.ElevatedButton(
                            "PDF",
                            icon=ft.icons.PICTURE_AS_PDF,
                            on_click=self.reporte_no_disponible,
                            bgcolor="#1E3A5F",
                            color="white",
                            height=40
                        ),
                    ], alignment=ft.MainAxisAlignment.END, spacing=8),
                    col={"xs": 12, "sm": 4, "md": 4, "lg": 4}
                )
            ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
            padding=ft.padding.only(left=20, right=20, top=15, bottom=5),
            bgcolor="white",
            border=ft.border.only(bottom=ft.BorderSide(1, "#E0E0E0"))
        )
        
        # ==========================================================
        # KPI CARDS MEJORADAS (RESPONSIVE)
        # ==========================================================
        def crear_kpi_card(titulo, valor, icono, color, subtitulo, bgcolor="#FFFFFF"):
            if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
            return ft.Container(
                content=ft.Column([
                    ft.Row([
                        ft.Container(
                            content=ft.Icon(icono, color=color, size=20),
                            bgcolor=color + "20",  # Versión transparente del color
                            padding=8,
                            border_radius=10
                        ),
                        ft.Column([
                            ft.Text(titulo, size=11, color="grey600"),
                            ft.Text(valor, size=22, weight=ft.FontWeight.BOLD, color="#1E3A5F"),
                        ], spacing=2, expand=True)
                    ], alignment=ft.MainAxisAlignment.START),
                    ft.Divider(height=8, color="transparent"),
                    ft.Text(subtitulo, size=9, color="grey500", italic=True),
                ], spacing=2),
                padding=15,
                bgcolor=bgcolor,
                border_radius=12,
                border=ft.border.all(1, "#E0E0E0"),
                shadow=ft.BoxShadow(blur_radius=8, color="#15000000"),
                col={"xs": 12, "sm": 6, "md": 3, "lg": 3}
            )
        
        # Datos KPI (ejemplo)
        kpis = ft.ResponsiveRow([
            crear_kpi_card("Registros", "156", ft.icons.ASSIGNMENT, "#1565C0", "últimos 7 días"),
            crear_kpi_card("Horas", "1,245", ft.icons.ACCESS_TIME, "#2E7D32", "totales"),
            crear_kpi_card("Eficiencia", "94%", ft.icons.TRENDING_UP, "#FF8F00", "promedio"),
            crear_kpi_card("Empleados", "18", ft.icons.PEOPLE, "#C62828", "activos"),
        ], spacing=12, run_spacing=12)
        
        # ==========================================================
        # PANEL DE FILTROS MEJORADO (RESPONSIVE)
        # ==========================================================
        dd_vehiculo = ft.Dropdown(
            label="Vehículo",
            hint_text="Seleccionar vehículo",
            options=[ft.dropdown.Option("TODOS", "Todos los vehículos")] + 
                    [ft.dropdown.Option(v[1]) for v in vehiculos],
            value="TODOS",
            border_radius=8,
            border_color="#1E3A5F",
            focused_border_color="#1565C0",
            dense=True,
            expand=True,
            bgcolor="white"
        )
        
        dd_empleado = ft.Dropdown(
            label="Empleado",
            hint_text="Seleccionar empleado",
            options=[ft.dropdown.Option("TODOS", "Todos los empleados")] + 
                    [ft.dropdown.Option(p[0]) for p in personal],
            value="TODOS",
            border_radius=8,
            border_color="#1E3A5F",
            focused_border_color="#1565C0",
            dense=True,
            expand=True,
            bgcolor="white"
        )
        
        # Selectores de fecha mejorados
        def crear_date_field(label, value, date_picker):
            if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
            return ft.Container(
                content=ft.Row([
                    ft.TextField(
                        value=value,
                        read_only=True,
                        border_radius=8,
                        border_color="#1E3A5F",
                        dense=True,
                        expand=True,
                        text_size=13,
                        prefix_icon=ft.icons.CALENDAR_TODAY
                    ),
                    ft.IconButton(
                        icon=ft.icons.CALENDAR_MONTH,
                        icon_color="#1E3A5F",
                        icon_size=20,
                        on_click=lambda _: setattr(date_picker, "open", True) or self.page.update(),
                        tooltip=f"Seleccionar {label.lower()}",
                        bgcolor="#F0F0F0",
                        width=40,
                        height=40
                    )
                ], spacing=4)
            )
        
        date_inicio = ft.DatePicker(
            on_change=lambda e: setattr(txt_fecha_inicio, 'value', e.control.value.strftime("%Y-%m-%d")) or 
                            self.page.update()
        )
        date_fin = ft.DatePicker(
            on_change=lambda e: setattr(txt_fecha_fin, 'value', e.control.value.strftime("%Y-%m-%d")) or 
                            self.page.update()
        )
        self.page.overlay.append(date_inicio)
        self.page.overlay.append(date_fin)
        
        txt_fecha_inicio = ft.TextField(value=fecha_inicio_str, visible=False)
        txt_fecha_fin = ft.TextField(value=fecha_fin_str, visible=False)
        
        panel_filtros = ft.Container(
            content=ft.Column([
                ft.Text(
                    "FILTROS DEL REPORTE", 
                    size=14, 
                    weight=ft.FontWeight.BOLD, 
                    color="#1E3A5F"
                ),
                ft.Container(height=10),
                ft.ResponsiveRow([
                    ft.Container(
                        content=ft.Column([
                            ft.Text("📅 FECHA INICIAL", size=10, weight=ft.FontWeight.BOLD, color="grey600"),
                            crear_date_field("fecha inicial", fecha_inicio_str, date_inicio),
                        ]),
                        col={"xs": 12, "sm": 6, "md": 3, "lg": 3}
                    ),
                    ft.Container(
                        content=ft.Column([
                            ft.Text("📅 FECHA FINAL", size=10, weight=ft.FontWeight.BOLD, color="grey600"),
                            crear_date_field("fecha final", fecha_fin_str, date_fin),
                        ]),
                        col={"xs": 12, "sm": 6, "md": 3, "lg": 3}
                    ),
                    ft.Container(
                        content=ft.Column([
                            ft.Text("🚛 VEHÍCULO", size=10, weight=ft.FontWeight.BOLD, color="grey600"),
                            dd_vehiculo,
                        ]),
                        col={"xs": 12, "sm": 6, "md": 3, "lg": 3}
                    ),
                    ft.Container(
                        content=ft.Column([
                            ft.Text("👤 EMPLEADO", size=10, weight=ft.FontWeight.BOLD, color="grey600"),
                            dd_empleado,
                        ]),
                        col={"xs": 12, "sm": 6, "md": 3, "lg": 3}
                    ),
                ], spacing=12, run_spacing=12),
                ft.Container(height=10),
                ft.Row([
                    ft.ElevatedButton(
                        "GENERAR REPORTE",
                        icon=ft.icons.SEARCH,
                        on_click=lambda _: self.generar_reporte_control(
                            fecha_inicio_str,
                            fecha_fin_str,
                            dd_vehiculo.value,
                            dd_empleado.value
                        ),
                        bgcolor="#1E3A5F",
                        color="white",
                        height=45,
                        expand=True,
                        style=ft.ButtonStyle(
                            shape=ft.RoundedRectangleBorder(radius=8),
                            elevation=2
                        )
                    ),
                ], alignment=ft.MainAxisAlignment.END)
            ]),
            padding=20,
            bgcolor="white",
            border_radius=12,
            border=ft.border.all(1, "#E0E0E0"),
            shadow=ft.BoxShadow(blur_radius=15, color="#15000000"),
            margin=ft.margin.only(left=20, right=20, top=10, bottom=15)
        )
        
        # ==========================================================
        # GRÁFICO DE RESUMEN MEJORADO
        # ==========================================================
        def crear_indicador(titulo, valor, color, porcentaje):
            if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
            return ft.Container(
                content=ft.Column([
                    ft.Text(titulo, size=11, color="grey600"),
                    ft.Row([
                        ft.Text(valor, size=22, weight=ft.FontWeight.BOLD, color=color),
                        ft.Text(f"({porcentaje})", size=11, color="grey500"),
                    ], spacing=4),
                    ft.ProgressBar(
                        value=float(porcentaje.strip('%'))/100,
                        color=color,
                        bgcolor="#E0E0E0",
                        height=6,
                        border_radius=3
                    ),
                ], spacing=4),
                padding=15,
                bgcolor="white",
                border_radius=10,
                border=ft.border.all(1, "#E0E0E0"),
                col={"xs": 12, "sm": 6, "md": 3, "lg": 3}
            )
        
        resumen = ft.Container(
            content=ft.Column([
                ft.Text("RESUMEN DE ACTIVIDAD", size=14, weight=ft.FontWeight.BOLD, color="#1E3A5F"),
                ft.Container(height=10),
                ft.ResponsiveRow([
                    crear_indicador("COMPLETADOS", "142", "#1B5E20", "85%"),
                    crear_indicador("EN CURSO", "28", "#E65100", "45%"),
                    crear_indicador("PENDIENTES", "12", "#9E9E9E", "15%"),
                    crear_indicador("EFICIENCIA", "87%", "#1565C0", "87%"),
                ], spacing=12, run_spacing=12)
            ]),
            padding=20,
            bgcolor="white",
            border_radius=12,
            border=ft.border.all(1, "#E0E0E0"),
            margin=ft.margin.only(left=20, right=20, top=10, bottom=15)
        )
        
        # ==========================================================
        # TABLA DE RESULTADOS PROFESIONAL
        # ==========================================================
        # Cabecera de tabla responsive
        # Solo muestro la parte corregida de la tabla en reporte_control_horario
# Reemplaza la sección de tabla_resultados con esto:

# ==========================================================
# TABLA DE RESULTADOS PROFESIONAL CON SCROLL RESPONSIVE
# ==========================================================
# Cabecera de tabla con ancho fijo para scroll horizontal
        cabecera_tabla = ft.Container(
            content=ft.Row([
                ft.Container(ft.Text("FECHA", weight="bold", size=11, color="white"), width=70),
                ft.Container(ft.Text("VH", weight="bold", size=11, color="white"), width=60),
                ft.Container(ft.Text("EMPLEADO", weight="bold", size=11, color="white"), width=120),
                ft.Container(ft.Text("ENTRADA", weight="bold", size=11, color="white"), width=70, alignment=ft.alignment.center),
                ft.Container(ft.Text("SALIDA", weight="bold", size=11, color="white"), width=70, alignment=ft.alignment.center),
                ft.Container(ft.Text("TIEMPO", weight="bold", size=11, color="white"), width=60, alignment=ft.alignment.center),
                ft.Container(ft.Text("ESTADO", weight="bold", size=11, color="white"), width=80, alignment=ft.alignment.center),
            ], spacing=5),
            bgcolor="#1E3A5F",
            padding=12,
            border_radius=ft.border_radius.only(top_left=8, top_right=8)
        )

        # Datos de ejemplo
        datos_ejemplo = [
            {"fecha": "02-24", "vh": "DMX-513", "empleado": "Administrador", "entrada": "06:11", "salida": "--", "tiempo": "02:45", "estado": "EN CURSO", "color": "#E65100"},
            {"fecha": "02-24", "vh": "NHR-385", "empleado": "Luis López", "entrada": "05:38", "salida": "00:38", "tiempo": "00:00", "estado": "COMPLETO", "color": "#1B5E20"},
        ]

        filas_tabla = []
        for idx, dato in enumerate(datos_ejemplo):
            bg_color = "#FFFFFF" if idx % 2 == 0 else "#F8F9FA"
            
            fila = ft.Container(
                content=ft.Row([
                    ft.Container(ft.Text(dato["fecha"], size=11), width=70),
                    ft.Container(ft.Text(dato["vh"], size=11, weight="bold"), width=60),
                    ft.Container(ft.Text(dato["empleado"], size=11), width=120),
                    ft.Container(ft.Text(dato["entrada"], size=11), width=70, alignment=ft.alignment.center),
                    ft.Container(ft.Text(dato["salida"], size=11), width=70, alignment=ft.alignment.center),
                    ft.Container(ft.Text(dato["tiempo"], size=11, color="#1565C0" if dato["tiempo"] != "--" else "grey"), width=60, alignment=ft.alignment.center),
                    ft.Container(
                        content=ft.Container(
                            content=ft.Text(dato["estado"], size=9, color="white", weight="bold"),
                            bgcolor=dato["color"],
                            padding=ft.padding.only(left=6, right=6, top=2, bottom=2),
                            border_radius=10
                        ),
                        width=80, alignment=ft.alignment.center
                    ),
                ], spacing=5),
                bgcolor=bg_color,
                padding=10,
                border=ft.border.only(bottom=ft.BorderSide(1, "#E0E0E0"))
            )
            filas_tabla.append(fila)

        # Tabla con scroll horizontal en móvil
        tabla_resultados = ft.Container(
            content=ft.Column([
                ft.Row([
                    ft.Text("DETALLE DE REGISTROS", size=14, weight="bold", color="#1E3A5F"),
                    ft.Container(
                        content=ft.Text(f"{len(datos_ejemplo)} registros", size=11, color="white"),
                        bgcolor="#1E3A5F",
                        padding=ft.padding.only(left=8, right=8, top=2, bottom=2),
                        border_radius=10
                    ),
                ], alignment="spaceBetween"),
                ft.Container(height=10),
                # Scroll horizontal solo cuando sea necesario
                ft.Row([
                    ft.Container(
                        content=ft.Column([
                            cabecera_tabla,
                            ft.Column(filas_tabla, spacing=0, scroll=ft.ScrollMode.AUTO, height=250),
                        ]),
                        # Ancho fijo en móvil para forzar scroll, automático en desktop
                        width=650 if self.page.width < 600 else None,
                    )
                ], scroll=ft.ScrollMode.AUTO if self.page.width < 600 else None),
            ]),
            padding=15,
            bgcolor="white",
            border_radius=10,
            border=ft.border.all(1, "#E0E0E0"),
            margin=ft.margin.only(left=15, right=15, top=10, bottom=15)
        )
        
        # ==========================================================
        # FOOTER (FECHA DE GENERACIÓN)
        # ==========================================================
        footer = ft.Container(
            content=ft.Row([
                ft.Text(
                    f"Generado: {datetime.now().strftime('%d/%m/%Y %I:%M %p')}",
                    size=10,
                    color="grey500",
                    italic=True
                ),
            ], alignment=ft.MainAxisAlignment.END),
            padding=ft.padding.only(right=20, bottom=10)
        )
        
        # ==========================================================
        # ENSAMBLE FINAL
        # ==========================================================
        cuerpo = ft.Column([
            header,
            ft.Container(content=kpis, padding=ft.padding.only(left=20, right=20, top=10)),
            panel_filtros,
            resumen,
            tabla_resultados,
            footer
        ], spacing=0, expand=True, scroll=ft.ScrollMode.AUTO)
        
        self.page.add(cuerpo)
        self.page.update()
    
    def generar_reporte_control(self, fecha_ini, fecha_fin, vehiculo, empleado):
        """Genera el reporte con los filtros aplicados"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        
        # Mostrar indicador de carga
        self.resultados_container.content = ft.Column([
            ft.Container(
                content=ft.Column([
                    ft.ProgressRing(),
                    ft.Text("Generando reporte...", size=14, color="grey"),
                ], horizontal_alignment="center", spacing=10),
                padding=50,
                bgcolor="#F5F5F5",
                border_radius=12
            )
        ])
        self.page.update()
        
        # Convertir filtros para DB
        v_sql = None if vehiculo == "TODOS" else vehiculo
        e_sql = None if empleado == "TODOS" else empleado
        
        # Obtener datos de rutas en el rango
        rutas = self.obtener_rutas_rango(fecha_ini, fecha_fin, v_sql, e_sql)
        
        # Construir tabla de resultados
        if rutas:
            filas = []
            for ruta in rutas:
                for emp in ruta["equipo"]:
                    marcas = self.obtener_marcas_empleado_rango(
                        emp, ruta["placa"], fecha_ini, fecha_fin
                    )
                    
                    if marcas:
                        for fecha, datos in marcas.items():
                            # Alternar colores de fondo
                            color_fila = "#FFFFFF" if len(filas) % 2 == 0 else "#F8F9FA"
                            
                            # Calcular tiempo si hay entrada y salida
                            tiempo = "--:--"
                            if "entrada" in datos and "salida" in datos:
                                try:
                                    fmt = "%H:%M"
                                    entrada = datetime.strptime(datos["entrada"], fmt)
                                    salida = datetime.strptime(datos["salida"], fmt)
                                    diff = salida - entrada
                                    horas = diff.seconds // 3600
                                    minutos = (diff.seconds % 3600) // 60
                                    tiempo = f"{horas:02d}:{minutos:02d}"
                                except:
                                    tiempo = "--:--"
                            elif "entrada" in datos:
                                tiempo = "EN CURSO"
                            
                            fila = ft.Container(
                                content=ft.Row([
                                    ft.Container(ft.Text(fecha[5:], size=11), width=70),
                                    ft.Container(ft.Text(ruta["placa"][:8], size=11, weight="bold"), width=70),
                                    ft.Container(ft.Text(emp[:15], size=11), width=150),
                                    ft.Container(ft.Text(datos.get("entrada", "--"), size=11), width=80, alignment=ft.alignment.center),
                                    ft.Container(ft.Text(datos.get("salida", "--"), size=11), width=80, alignment=ft.alignment.center),
                                    ft.Container(ft.Text(tiempo, size=11, color="#1565C0" if tiempo != "--:--" else "grey"), width=70, alignment=ft.alignment.center),
                                    ft.Container(
                                        content=ft.Container(
                                            content=ft.Text(
                                                datos.get("estado", "PEND"), 
                                                size=9, color="white", weight="bold"
                                            ),
                                            bgcolor=datos.get("color", "#9E9E9E"),
                                            padding=ft.padding.only(left=8, right=8, top=3, bottom=3),
                                            border_radius=12
                                        ),
                                        width=90, alignment=ft.alignment.center
                                    ),
                                ], spacing=5),
                                bgcolor=color_fila,
                                padding=12,
                                border=ft.border.only(bottom=ft.BorderSide(1, "#E0E0E0"))
                            )
                            filas.append(fila)
            
            # Actualizar contador de registros
            contador_text = f"{len(filas)} registros encontrados"
            
            # Ensamblar resultados
            resultados = ft.Column(filas, spacing=0, scroll=ft.ScrollMode.AUTO, height=400)
            
            # Actualizar el contador en el header de la tabla
            # Nota: En una implementación real, necesitarías actualizar el texto del contador
            
        else:
            resultados = ft.Container(
                content=ft.Column([
                    ft.Text("📭", size=50),
                    ft.Text("No hay datos para los filtros seleccionados", size=14, color="grey"),
                ], horizontal_alignment="center", spacing=10),
                padding=50,
                bgcolor="white",
                border_radius=12
            )
            contador_text = "0 registros encontrados"
        
        # Actualizar contenedor
        self.resultados_container.content = resultados
        self.page.update()
    
    # ==========================================================
    # MÉTODOS DE CONSULTA A DB
    # ==========================================================
    
    def obtener_rutas_rango(self, fecha_ini, fecha_fin, placa=None, empleado=None):
        """Obtiene rutas en un rango de fechas"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        query = """SELECT fecha, vehiculo_placa, empleados_json, hora_inicio_prog, hora_fin_prog 
                   FROM planeacion_rutas 
                   WHERE fecha BETWEEN ? AND ?"""
        params = [fecha_ini, fecha_fin]
        
        if placa:
            query += " AND vehiculo_placa = ?"
            params.append(placa)
        
        if empleado:
            query += " AND empleados_json LIKE ?"
            params.append(f'%"{empleado}"%')
        
        query += " ORDER BY fecha DESC, vehiculo_placa"
        
        rutas = []
        try:
            with self.db.conectar() as conn:
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
        except Exception as e:
            print(f"Error obteniendo rutas: {e}")
        
        return rutas
    
    def obtener_marcas_empleado_rango(self, usuario, placa, fecha_ini, fecha_fin):
        """Obtiene marcas de un usuario agrupadas por fecha"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        with self.db.conectar() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT fecha, tipo_marca, hora 
                FROM asistencia 
                WHERE usuario = ? AND vehiculo_placa = ? 
                AND fecha BETWEEN ? AND ?
                ORDER BY fecha, id
            """, (usuario, placa, fecha_ini, fecha_fin))
            
            resultados = cursor.fetchall()
            
            # Agrupar por fecha
            marcas_por_fecha = {}
            for fecha, tipo, hora in resultados:
                if fecha not in marcas_por_fecha:
                    marcas_por_fecha[fecha] = {}
                marcas_por_fecha[fecha][tipo] = hora[:5]  # Solo HH:MM
                
                # Determinar estado y color
                if "salida" in marcas_por_fecha[fecha]:
                    marcas_por_fecha[fecha]["estado"] = "COMPLETO"
                    marcas_por_fecha[fecha]["color"] = "#1B5E20"
                elif "entrada" in marcas_por_fecha[fecha]:
                    marcas_por_fecha[fecha]["estado"] = "EN CURSO"
                    marcas_por_fecha[fecha]["color"] = "#E65100"
                else:
                    marcas_por_fecha[fecha]["estado"] = "PENDIENTE"
                    marcas_por_fecha[fecha]["color"] = "#9E9E9E"
            
            return marcas_por_fecha