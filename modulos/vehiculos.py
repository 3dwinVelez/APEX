import flet as ft

class VehiculosModule:
    """
    🚛 MÓDULO DE GESTIÓN DE VEHÍCULOS
    CRUD de flota vehicular
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

    def mostrar_maestro_vehiculos(self, e=None):
        """Muestra listado de vehículos registrados"""
        self.page.clean()
        
        try:
            vehiculos = self.db.obtener_lista_vehiculos() 
        except Exception as err:
            self.page.add(ft.Text(f"Error al cargar vehículos: {err}", color="red"))
            return
        
        grid_vehiculos = ft.ResponsiveRow(spacing=10, run_spacing=10)
        
        for v in vehiculos:
            # v: (id, placa, modelo, estado)
            placa = str(v[1]).upper()
            modelo = str(v[2]) if v[2] else "N/A"
            estado = str(v[3]).upper()
            
            # Colores de estado Apex
            color_estado = "#1B5E20" if estado == "DISPONIBLE" else "#E65100"

            grid_vehiculos.controls.append(
                ft.Container(
                    content=ft.Row([
                        ft.Text("🚚", size=25),
                        ft.Column([
                            ft.Text(placa, weight="bold", size=16),
                            ft.Text(f"Modelo: {modelo}", size=12, color="grey"),
                        ], expand=True, spacing=1),
                        ft.Container(
                            content=ft.Text(estado, size=9, weight="bold", color="white"),
                            bgcolor=color_estado,
                            padding=ft.padding.only(left=8, right=8, top=4, bottom=4),
                            border_radius=5
                        ),
                        ft.IconButton(
                            icon=ft.icons.EDIT,
                            icon_size=18,
                            on_click=lambda _, p=placa, m=modelo, e=estado: self.editar_vehiculo(p, m, e)
                        )
                    ]),
                    padding=15, bgcolor="white", border_radius=12,
                    border=ft.border.all(1, "#E0E0E0"),
                    col={"sm": 12, "md": 6, "lg": 4}
                )
            )

        cuerpo = ft.Column([
            ft.Container(height=10),
            ft.Row([
                ft.TextButton("← VOLVER", on_click=lambda _: self.volver_callback(self.sesion["usuario"])),
                ft.Text("GESTIÓN DE VEHÍCULOS", weight="bold", size=20),
            ], alignment="spaceBetween"),
            ft.Container(height=1, bgcolor="#E0E0E0"),
            ft.Container(height=15),
            ft.ElevatedButton(
                "+ REGISTRAR VEHÍCULO", 
                bgcolor="black", color="white", height=50, 
                on_click=lambda _: self.abrir_formulario_vehiculo(),
                style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10))
            ),
            ft.Container(height=20),
            ft.Text("FLOTA REGISTRADA", size=11, weight="bold", color="grey"),
            grid_vehiculos
        ], scroll="auto")

        self.page.add(self.zona_segura(cuerpo))
        self.page.update()

    def abrir_formulario_vehiculo(self, placa_edit=None, modelo_edit=None):
        """Formulario para registrar o editar vehículo"""
        self.page.clean()
        
        txt_placa = ft.TextField(
            label="Placa del Vehículo", 
            border_radius=10, 
            bgcolor="white",
            value=placa_edit if placa_edit else ""
        )
        lbl_placa = ft.Text("  Ej: ABC-123", size=11, color="grey")
        
        txt_modelo = ft.TextField(
            label="Modelo / Descripción", 
            border_radius=10, 
            bgcolor="white",
            value=modelo_edit if modelo_edit else ""
        )
        lbl_modelo = ft.Text("  Ej: NPR 500 - 2025", size=11, color="grey")

        # Selector de estado (solo en edición)
        dd_estado = None
        if placa_edit:
            dd_estado = ft.Dropdown(
                label="Estado",
                options=[
                    ft.dropdown.Option("disponible"),
                    ft.dropdown.Option("en ruta"),
                    ft.dropdown.Option("mantenimiento")
                ],
                value="disponible",
                border_radius=10
            )

        def guardar_vehiculo(e):
            if not txt_placa.value:
                txt_placa.error_text = "La placa es obligatoria"
                self.page.update()
                return
                
            # Validar formato básico de placa
            placa = txt_placa.value.upper().strip()
            
            if self.db.insertar_vehiculo(placa, txt_modelo.value):
                self.page.snack_bar = ft.SnackBar(
                    ft.Text(f"✅ Vehículo {placa} registrado"), 
                    bgcolor="#1B5E20"
                )
                self.page.snack_bar.open = True
                self.mostrar_maestro_vehiculos()
            else:
                self.page.snack_bar = ft.SnackBar(
                    ft.Text("❌ Error: La placa podría ya existir"), 
                    bgcolor="#B71C1C"
                )
                self.page.snack_bar.open = True
                self.page.update()

        def cancelar(e):
            self.mostrar_maestro_vehiculos()

        # Construir formulario
        controles = [
            ft.Text(
                "EDITAR VEHÍCULO" if placa_edit else "NUEVO VEHÍCULO", 
                size=22, weight="bold", text_align="center"
            ),
            ft.Container(height=10),
            txt_placa, 
            lbl_placa,
            ft.Container(height=5),
            txt_modelo, 
            lbl_modelo,
        ]
        
        if dd_estado:
            controles.extend([ft.Container(height=5), dd_estado])
        
        controles.extend([
            ft.Container(height=15),
            ft.ElevatedButton(
                "GUARDAR VEHÍCULO", 
                bgcolor="black", color="white", height=55,
                on_click=guardar_vehiculo,
                style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10))
            ),
            ft.TextButton("Cancelar", on_click=cancelar)
        ])

        tarjeta_form = ft.Container(
            content=ft.Column(controles, horizontal_alignment="stretch", spacing=10),
            padding=35, bgcolor="white", border_radius=20, border=ft.border.all(1, "#E0E0E0")
        )

        self.page.add(self.zona_segura(tarjeta_form, col_size={"sm": 12, "md": 8, "lg": 5}))
        self.page.update()

    def editar_vehiculo(self, placa, modelo, estado):
        """Abre formulario de edición para vehículo existente"""
        # Por ahora, redirige al mismo formulario
        # En futura versión, implementar actualización
        self.abrir_formulario_vehiculo(placa, modelo)