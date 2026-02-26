import flet as ft
import json
from datetime import datetime

class ServiciosModule:
    """
    🔧 MÓDULO DE SERVICIOS TÉCNICOS
    Gestión de inspecciones, novedades y órdenes de servicio
    """
    
    def __init__(self, page, db, sesion, volver_callback):
        self.page = page
        self.db = db
        self.sesion = sesion
        self.volver_callback = volver_callback
        self.orden_activa = None  # Para seguimiento de orden en curso
        self.tiempo_inicio = None  # Para cronómetro

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

    def menu_servicio_tecnico(self, e=None):
        """Menú principal del módulo"""
        self.page.clean()
        
        menu_items = ft.Column(spacing=15, horizontal_alignment="stretch")
        opciones = [
            ("🆕 Nuevo Servicio", self.mostrar_seleccion_equipo),
            ("📜 Mi Historial", self.mostrar_historial),
            ("📄 Reporte PDF", None)  # Pendiente de implementar
        ]
        
        for texto, accion in opciones:
            menu_items.controls.append(
                ft.Container(
                    content=ft.Text(texto, weight="bold", size=16, text_align="center"),
                    padding=20, bgcolor="white", border_radius=12,
                    border=ft.border.all(1, "#E0E0E0"),
                    on_click=lambda _, a=accion: a() if a else None
                )
            )

        cuerpo = ft.Column([
            ft.Container(height=20),
            ft.Text("GESTIÓN DE SERVICIOS", size=24, weight="bold", text_align="center"),
            ft.Container(height=10),
            menu_items,
            ft.Container(height=10),
            ft.TextButton("Volver al Lobby", on_click=lambda _: self.volver_callback(self.sesion["nombre"]))
        ], horizontal_alignment="center")

        self.page.add(self.zona_segura(cuerpo, col_size={"sm": 12, "md": 8, "lg": 5}))
        self.page.update()

    def mostrar_historial(self, e=None):
        """Muestra el historial de servicios del técnico"""
        self.page.clean()
        
        # Placeholder - Implementar cuando tengas la tabla de órdenes completa
        cuerpo = ft.Column([
            ft.TextButton("← VOLVER", on_click=self.menu_servicio_tecnico),
            ft.Text("HISTORIAL DE SERVICIOS", size=22, weight="bold"),
            ft.Container(
                content=ft.Text("Próximamente: Listado de servicios realizados", color="grey"),
                padding=40, bgcolor="white", border_radius=15
            )
        ])
        
        self.page.add(self.zona_segura(cuerpo))
        self.page.update()

    def mostrar_seleccion_equipo(self, e=None):
        """Muestra catálogo de equipos para seleccionar"""
        self.page.clean()
        
        try:
            equipos = self.db.obtener_referencias_maestras()
        except AttributeError:
            self.page.add(ft.Text("❌ Error al cargar equipos", color="red"))
            self.page.update()
            return
        
        grid_equipos = ft.ResponsiveRow(spacing=10, run_spacing=10)
        
        for eq in equipos:
            # eq: (id, nombre_referencia, descripcion, costo_mano_obra, piezas_json)
            grid_equipos.controls.append(
                ft.Container(
                    content=ft.Column([
                        ft.Text("⚙️", size=30),
                        ft.Text(eq[1], weight="bold", size=14, text_align="center"),
                        ft.Text(f"Costo M.O: ${eq[3]:,.0f}", size=11, color="green"),
                    ], horizontal_alignment="center", spacing=5),
                    padding=20, bgcolor="white", border_radius=12,
                    border=ft.border.all(1, "#E0E0E0"),
                    on_click=lambda _, r=eq: self.mostrar_inspeccion(r), 
                    col={"sm": 12, "md": 6, "lg": 4}
                )
            )

        cuerpo = ft.Column([
            ft.Container(height=10),
            ft.Row([
                ft.TextButton("← VOLVER", on_click=self.menu_servicio_tecnico),
                ft.Text("SELECCIONAR EQUIPO", weight="bold", size=20)
            ], vertical_alignment="center", alignment="start"),
            grid_equipos
        ])

        self.page.add(self.zona_segura(cuerpo, col_size={"sm": 12, "md": 10, "lg": 8}))
        self.page.update()

    def mostrar_inspeccion(self, ref_data):
        """Muestra checklist de inspección para el equipo seleccionado"""
        self.page.clean()
        
        id_equipo = ref_data[0]
        nombre_equipo = ref_data[1]
        costo_mano_obra = ref_data[3]
        
        try:
            componentes = json.loads(ref_data[4]) if ref_data[4] else ["Inspección General"]
        except:
            componentes = ["Inspección General", "Estructura", "Funcionamiento"]
        
        # Diccionario para almacenar estados de componentes
        estados_componentes = {}
        checklist_items = []
        
        for c in componentes:
            # Checkbox para el componente
            chk = ft.Checkbox(label=c, fill_color="black")
            
            # Botón para reportar novedad
            btn_novedad = ft.TextButton(
                "⚠️ NOVEDAD",
                style=ft.ButtonStyle(color="red"),
                on_click=lambda _, comp=c: self.abrir_formulario_novedad(comp, nombre_equipo, id_equipo)
            )
            
            # Guardar referencia al checkbox
            estados_componentes[c] = chk
            
            checklist_items.append(
                ft.Container(
                    content=ft.Row([chk, btn_novedad], alignment="spaceBetween"),
                    padding=5
                )
            )
        
        lista_checks = ft.Column(controls=checklist_items, spacing=5)
        
        # Crear orden de servicio al iniciar inspección
        def iniciar_inspeccion(e):
            tecnico_id = self.sesion.get("id", 1)
            orden_id = self.db.crear_orden_servicio(tecnico_id, id_equipo)
            
            if orden_id:
                self.orden_activa = orden_id
                self.tiempo_inicio = datetime.now()
                
                self.page.snack_bar = ft.SnackBar(
                    ft.Text(f"✅ Inspección iniciada - Orden #{orden_id}"), 
                    bgcolor="#1B5E20"
                )
                self.page.snack_bar.open = True
                
                # Aquí podrías redirigir a una vista de cronómetro
            else:
                self.page.snack_bar = ft.SnackBar(
                    ft.Text("❌ Error al crear orden"), 
                    bgcolor="#B71C1C"
                )
                self.page.snack_bar.open = True
            self.page.update()
        
        tarjeta_inspeccion = ft.Container(
            content=ft.Column([
                ft.Text("🔍 INSPECCIÓN", size=22, weight="bold"),
                ft.Text(nombre_equipo, color="blue", weight="bold", size=18),
                ft.Text(f"Costo M.O: ${costo_mano_obra:,.0f}", color="green", size=14),
                ft.Container(height=1, bgcolor="#E0E0E0"),
                lista_checks,
                ft.Container(height=10),
                ft.ElevatedButton(
                    "INICIAR INSPECCIÓN", 
                    bgcolor="black", color="white", height=50,
                    on_click=iniciar_inspeccion,
                    style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10))
                ),
                ft.TextButton("← Volver a equipos", on_click=self.mostrar_seleccion_equipo)
            ], horizontal_alignment="center", spacing=15),
            padding=30, bgcolor="white", border_radius=20, border=ft.border.all(1, "#E0E0E0")
        )

        cuerpo = ft.Column([
            ft.Container(height=10),
            tarjeta_inspeccion
        ])

        self.page.add(self.zona_segura(cuerpo, col_size={"sm": 12, "md": 10, "lg": 6}))
        self.page.update()

    def abrir_formulario_novedad(self, componente, nombre_equipo, id_equipo):
        """Formulario para reportar novedad en un componente"""
        self.page.clean()
        
        opciones_novedad = [
            ft.dropdown.Option("Pieza Rota / Quebrada"),
            ft.dropdown.Option("Avería de Transporte (Rayón)"),
            ft.dropdown.Option("Defecto de Fábrica"),
            ft.dropdown.Option("Falta de Herraje / Tornillería"),
            ft.dropdown.Option("Pieza con Medida Incorrecta"),
            ft.dropdown.Option("Otro (Especificar)")
        ]

        dd_tipo_novedad = ft.Dropdown(
            label="Tipo de Novedad", 
            options=opciones_novedad, 
            border_radius=10
        )
        
        txt_descripcion = ft.TextField(
            label="Observaciones adicionales", 
            multiline=True, min_lines=2, border_radius=10
        )
        
        btn_foto = ft.ElevatedButton(
            "📷 ADJUNTAR EVIDENCIA", 
            color="black", bgcolor="#F5F5F5", 
            on_click=lambda _: self.page.snack_bar.open if setattr(self.page.snack_bar, 'open', True) else None
        )

        def enviar_reporte(e):
            # Aquí guardarías la novedad en la orden activa
            self.page.snack_bar = ft.SnackBar(
                ft.Text("✅ Novedad reportada"), 
                bgcolor="#1B5E20"
            )
            self.page.snack_bar.open = True
            self.mostrar_inspeccion(self.db.obtener_referencia_por_id(id_equipo))

        tarjeta_novedad = ft.Container(
            content=ft.Column([
                ft.Row([ft.Text("⚠️", size=30), ft.Text("REPORTE DE NOVEDAD", size=20, weight="bold")], alignment="center"),
                ft.Text(f"Componente: {componente}", color="grey", size=13),
                ft.Text(f"Equipo: {nombre_equipo}", color="grey", size=12),
                ft.Divider(height=10),
                dd_tipo_novedad,
                txt_descripcion,
                btn_foto,
                ft.Container(height=10),
                ft.ElevatedButton(
                    "ENVIAR REPORTE", bgcolor="black", color="white", height=50,
                    on_click=enviar_reporte,
                    style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10))
                ),
                ft.TextButton("Cancelar", on_click=lambda _: self.mostrar_inspeccion(
                    self.db.obtener_referencia_por_id(id_equipo)
                ))
            ], horizontal_alignment="stretch", spacing=15),
            padding=35, bgcolor="white", border_radius=20, border=ft.border.all(1, "#E0E0E0")
        )

        self.page.add(self.zona_segura(tarjeta_novedad, col_size={"sm": 12, "md": 8, "lg": 5}))
        self.page.update()

    def iniciar_orden_equipo(self, id_equipo, nombre_equipo):
        """Inicia una orden de servicio (versión simplificada)"""
        tecnico_id = self.sesion.get("id", 1)
        orden_id = self.db.crear_orden_servicio(tecnico_id, id_equipo)
        
        if orden_id:
            self.page.snack_bar = ft.SnackBar(
                ft.Text(f"✅ Orden #{orden_id} iniciada para: {nombre_equipo}"), 
                bgcolor="#1B5E20"
            )
        else:
            self.page.snack_bar = ft.SnackBar(
                ft.Text("❌ Error al crear orden"), 
                bgcolor="#B71C1C"
            )
        self.page.snack_bar.open = True
        self.page.update()