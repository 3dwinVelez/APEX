import flet as ft
import json

class ReferenciasModule:
    """
    📦 MÓDULO DE REFERENCIAS
    Catálogo de productos con checklist de piezas y costos
    """
    
    def __init__(self, page, db, sesion, volver_callback):
        self.page = page
        self.db = db
        self.sesion = sesion
        self.volver_callback = volver_callback

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

    def mostrar_maestro_referencias(self, e=None):
        """Muestra el catálogo completo de referencias"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        self.page.clean()
        
        try:
            equipos = self.db.obtener_referencias_maestras()
        except AttributeError:
            self.page.add(ft.Text("❌ Error: Verifica el nombre en DBManager.", color="red"))
            return

        grid_referencias = ft.ResponsiveRow(spacing=10, run_spacing=10)
        
        for eq in equipos:
            # eq: (id, nombre_referencia, descripcion, costo_mano_obra, piezas_json)
            id_ref = eq[0]
            nombre = eq[1]
            desc = eq[2] if eq[2] else "Sin descripción"
            costo = eq[3] if eq[3] else 0
            
            # Intentar obtener piezas para mostrar contador
            try:
                piezas = json.loads(eq[4]) if eq[4] else []
                num_piezas = len(piezas)
            except:
                num_piezas = 0

            grid_referencias.controls.append(
                ft.Container(
                    content=ft.Row([
                        ft.Text("📦", size=25),
                        ft.Column([
                            ft.Text(nombre, weight="bold", size=15), 
                            ft.Text(f"{num_piezas} componentes | ${costo:,.0f}", size=11, color="green"),
                            ft.Text(desc[:30] + "..." if len(desc) > 30 else desc, size=9, color="grey")
                        ], expand=True, spacing=1),
                        ft.Icon(ft.icons.CHEVRON_RIGHT, size=20, color="black")
                    ]),
                    padding=15, bgcolor="white", border_radius=12, 
                    border=ft.border.all(1, "#E0E0E0"),
                    on_click=lambda _, r=eq: self.abrir_detalle_referencia(r),
                    col={"sm": 12, "md": 6, "lg": 4}
                )
            )

        cuerpo = ft.Column([
            ft.Container(height=10),
            ft.Row([
                ft.TextButton("← VOLVER", on_click=lambda _: self.volver_callback(self.sesion["usuario"])),
                ft.Text("GESTIÓN DE REFERENCIAS", weight="bold", size=20),
            ], alignment="spaceBetween"),
            ft.Container(height=1, bgcolor="#E0E0E0"),
            ft.Container(height=15),
            ft.ElevatedButton(
                "+ AGREGAR REFERENCIA", 
                bgcolor="black", color="white", height=50, 
                on_click=lambda _: self.abrir_formulario_referencia(),
                style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10))
            ),
            ft.Container(height=20),
            ft.Text("CATÁLOGO DE PRODUCTOS", size=11, weight="bold", color="grey"),
            grid_referencias,
        ], scroll="auto")

        self.page.add(self.zona_segura(cuerpo))
        self.page.update()

    def abrir_detalle_referencia(self, ref_data):
        """Muestra detalle de una referencia con checklist de piezas"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        self.page.clean()
        
        id_ref = ref_data[0]
        nombre_mueble = ref_data[1]
        descripcion = ref_data[2] if ref_data[2] else ""
        costo = ref_data[3] if ref_data[3] else 0
        
        try:
            lista_piezas = json.loads(ref_data[4]) if ref_data[4] else ["Sin piezas definidas"]
        except:
            lista_piezas = ["Error al cargar piezas"]

        # Crear checklist de piezas
        checks_piezas = ft.Column(spacing=8)
        for pieza in lista_piezas:
            checks_piezas.controls.append(
                ft.Container(
                    content=ft.Row([
                        ft.Checkbox(label=pieza, fill_color="black"),
                        ft.TextButton(
                            "⚠️ NOVEDAD", 
                            style=ft.ButtonStyle(color="red", bgcolor="#FFEBEE"),
                            on_click=lambda _, p=pieza: self.abrir_novedad_pieza(p, nombre_mueble, id_ref)
                        )
                    ], alignment="spaceBetween"),
                    padding=5,
                    bgcolor="#FAFAFA",
                    border_radius=8
                )
            )

        inspeccion_card = ft.Container(
            content=ft.Column([
                ft.Row([ft.Text("🔍", size=30), ft.Text("INSPECCIÓN", size=22, weight="bold")], alignment="center"),
                ft.Text(nombre_mueble, color="blue", weight="bold", size=18, text_align="center"),
                ft.Text(descripcion, size=12, color="grey", text_align="center", italic=True),
                ft.Text(f"Costo M.O: ${costo:,.0f}", size=14, color="green", weight="bold"),
                ft.Divider(),
                ft.Text("LISTA DE COMPONENTES", size=14, weight="bold"),
                checks_piezas,
                ft.Container(height=20),
                ft.Row([
                    ft.ElevatedButton(
                        "INICIAR CRONÓMETRO",
                        bgcolor="#263238", color="white",
                        height=45, expand=True,
                        style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10))
                    ),
                    ft.ElevatedButton(
                        "EDITAR",
                        bgcolor="white", color="black",
                        height=45, expand=True,
                        style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10)),
                        on_click=lambda _: self.abrir_formulario_referencia(ref_data)
                    )
                ], spacing=10)
            ], horizontal_alignment="center", spacing=10),
            padding=25, bgcolor="white", border_radius=20, border=ft.border.all(1, "#E0E0E0")
        )

        cuerpo = ft.Column([
            ft.TextButton("← Volver al catálogo", on_click=lambda _: self.mostrar_maestro_referencias()),
            inspeccion_card
        ])
        
        self.page.add(self.zona_segura(cuerpo, col_size={"sm": 12, "md": 9, "lg": 6}))
        self.page.update()
    
    def abrir_novedad_pieza(self, pieza, nombre_mueble, id_ref):
        """Formulario rápido para reportar novedad en pieza"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        self.page.snack_bar = ft.SnackBar(
            ft.Text(f"⚠️ Novedad reportada en: {pieza}"), 
            bgcolor="#E65100"
        )
        self.page.snack_bar.open = True
        self.page.update()
    
    def abrir_formulario_referencia(self, ref_data=None):
        """Formulario para crear o editar referencia"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        self.page.clean()
        
        modo_edicion = ref_data is not None
        
        txt_nom = ft.TextField(
            label="Nombre Referencia", 
            border_radius=10,
            value=ref_data[1] if modo_edicion else ""
        )
        txt_desc = ft.TextField(
            label="Descripción", 
            multiline=True, border_radius=10, min_lines=3,
            value=ref_data[2] if modo_edicion else ""
        )
        txt_costo = ft.TextField(
            label="Costo M.O ($)", 
            border_radius=10, keyboard_type=ft.KeyboardType.NUMBER,
            value=str(ref_data[3]) if modo_edicion else ""
        )
        
        # Campo para piezas (separadas por coma)
        piezas_actuales = ""
        if modo_edicion and ref_data[4]:
            try:
                piezas_lista = json.loads(ref_data[4])
                piezas_actuales = ", ".join(piezas_lista)
            except:
                piezas_actuales = ""
                
        txt_piezas = ft.TextField(
            label="Componentes (separados por coma)", 
            border_radius=10,
            value=piezas_actuales,
            hint_text="Ej: Motor, Bomba, Cable, Estructura"
        )

        def guardar_evt(e):
            if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
            if not txt_nom.value:
                self.page.snack_bar = ft.SnackBar(ft.Text("❌ El nombre es obligatorio"), bgcolor="#B71C1C")
                self.page.snack_bar.open = True
                self.page.update()
                return
                
            # Procesar piezas: convertir texto a lista y luego a JSON
            if txt_piezas.value:
                piezas_lista = [p.strip() for p in txt_piezas.value.split(",") if p.strip()]
                piezas_json = json.dumps(piezas_lista)
            else:
                piezas_json = json.dumps(["Sin piezas definidas"])
            
            if self.db.insertar_referencia_maestra(
                txt_nom.value, 
                txt_desc.value or "", 
                float(txt_costo.value or 0), 
                piezas_json
            ):
                self.page.snack_bar = ft.SnackBar(
                    ft.Text("✅ Referencia guardada"), 
                    bgcolor="#1B5E20"
                )
                self.page.snack_bar.open = True
                self.mostrar_maestro_referencias()
            else:
                self.page.snack_bar = ft.SnackBar(
                    ft.Text("❌ Error al guardar"), 
                    bgcolor="#B71C1C"
                )
                self.page.snack_bar.open = True
                self.page.update()

        tarjeta_form = ft.Container(
            content=ft.Column([
                ft.Text(
                    "EDITAR REFERENCIA" if modo_edicion else "NUEVA REFERENCIA", 
                    size=22, weight="bold", text_align="center"
                ),
                ft.Container(height=10),
                txt_nom, 
                txt_desc, 
                txt_costo,
                txt_piezas,
                ft.Container(height=10),
                ft.ElevatedButton(
                    "GUARDAR REFERENCIA", 
                    bgcolor="black", color="white", height=50, 
                    on_click=guardar_evt,
                    style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10))
                ),
                ft.TextButton("Cancelar", on_click=lambda _: self.mostrar_maestro_referencias())
            ], horizontal_alignment="stretch", spacing=15),
            padding=35, bgcolor="white", border_radius=20, border=ft.border.all(1, "#E0E0E0")
        )

        self.page.add(self.zona_segura(tarjeta_form, col_size={"sm": 12, "md": 8, "lg": 5}))
        self.page.update()