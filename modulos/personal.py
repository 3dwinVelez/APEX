import flet as ft

class PersonalModule:
    """
    👥 MÓDULO DE GESTIÓN DE PERSONAL
    CRUD completo de empleados, técnicos y administradores optimizado para Web/Railway
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
        ], alignment=ft.MainAxisAlignment.CENTER) # Corregido alineamiento

    def generar_id_auto(self, rol):
        """Genera ID automático basado en rol y contador"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        try:
            # Aseguramos que db tenga el método necesario
            conteo = self.db.contar_usuarios_por_rol(rol) + 1
            prefijo = "APXTEC" if rol == "tecnico" else "APXEMP" if rol == "empleado" else "APXADM"
            return f"{prefijo}{str(conteo).zfill(3)}"
        except Exception as e:
            print(f"⚠️ Error generando ID: {e}")
            return "ID-TEMP"

    def mostrar_maestro_personal(self, e=None):
        """Muestra listado de personal registrado"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        self.page.clean()
        
        # Cargando lista desde la DB
        colaboradores = self.db.obtener_lista_personal()
        grid_personal = ft.ResponsiveRow(spacing=10, run_spacing=10)
        
        if not colaboradores:
            grid_personal.controls.append(
                ft.Container(
                    content=ft.Text("No hay personal registrado aún", italic=True, color="grey"),
                    padding=20
                )
            )
        else:
            for p in colaboradores:
                # p: (nombre, rol, salario_base, id_interno)
                nom = str(p[0])
                rol_p = str(p[1]).upper() if p[1] else "SIN ROL"
                id_int = p[3] if len(p) > 3 and p[3] else "---"
                
                grid_personal.controls.append(
                    ft.Container(
                        content=ft.Row([
                            ft.Text("👤", size=20),
                            ft.Column([
                                ft.Text(nom, weight="bold", size=15),
                                ft.Text(f"{rol_p} • ID: {id_int}", size=11, color="grey"),
                            ], expand=True, spacing=1),
                            ft.IconButton(
                                icon=ft.icons.EDIT_OUTLINED,
                                icon_color="blue",
                                on_click=lambda _, n=nom: self.abrir_formulario_usuario(n)
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
                ft.TextButton("← VOLVER", on_click=lambda _: self.volver_callback(self.sesion["nombre"])),
                ft.Text("GESTIÓN DE PERSONAL", weight="bold", size=20),
            ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
            ft.Container(height=1, bgcolor="#E0E0E0"),
            ft.Container(height=15),
            ft.ElevatedButton(
                "+ CREAR NUEVO USUARIO", 
                bgcolor="black", color="white", 
                height=50, 
                on_click=lambda _: self.abrir_formulario_usuario(),
                style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10))
            ),
            ft.Container(height=20),
            ft.Text("COLABORADORES REGISTRADOS", size=11, weight="bold", color="grey"),
            grid_personal 
        ], scroll=ft.ScrollMode.AUTO)

        self.page.add(self.zona_segura(cuerpo))
        self.page.update()

    def abrir_formulario_usuario(self, nombre_edit=None):
        """Menú de selección de rol para nuevo usuario"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        self.page.clean()
        
        tarjeta_seleccion = ft.Container(
            content=ft.Column([
                ft.Text("GESTIÓN DE ACCESOS", size=22, weight="bold", color="black"),
                ft.Text("Selecciona el perfil para el nuevo registro", size=14, color="grey"),
                ft.Container(height=10),
                ft.ElevatedButton(
                    "🛡️ ADMINISTRADOR", height=60, bgcolor="#F8F9FA", color="black", 
                    on_click=lambda _: self.form_especifico("admin"), width=400
                ),
                ft.ElevatedButton(
                    "⚙️ TÉCNICO", height=60, bgcolor="#F8F9FA", color="black", 
                    on_click=lambda _: self.form_especifico("tecnico"), width=400
                ),
                ft.ElevatedButton(
                    "👤 EMPLEADO", height=60, bgcolor="#F8F9FA", color="black", 
                    on_click=lambda _: self.form_especifico("empleado"), width=400
                ),
                ft.Container(height=10),
                ft.TextButton("Volver al Listado", on_click=lambda _: self.mostrar_maestro_personal())
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=15),
            bgcolor="white", padding=40, border_radius=20, border=ft.border.all(1, "#E0E0E0"),
        )

        self.page.add(self.zona_segura(tarjeta_seleccion, col_size={"sm": 12, "md": 8, "lg": 5}))
        self.page.update()

    def form_especifico(self, rol):
        """Formulario específico según el rol seleccionado"""
        if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
        self.page.clean()
        nuevo_id = self.generar_id_auto(rol)
        
        txt_nombre = ft.TextField(label="Nombre Completo", border_radius=10, focused_border_color="black")
        txt_doc = ft.TextField(label="Documento Identidad", border_radius=10, keyboard_type=ft.KeyboardType.NUMBER)
        txt_pass = ft.TextField(
            label="Contraseña de Acceso", password=True, 
            border_radius=10, can_reveal_password=True
        )
        
        container_id = ft.Container(
            content=ft.Column([
                ft.Text("ID DE ACCESO GENERADO", size=10, color="white", weight="bold"),
                ft.Text(nuevo_id, size=24, weight="bold", color="white"),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=2),
            bgcolor="#263238", padding=20, border_radius=12
        )

        controles = [
            ft.Text(f"REGISTRO DE {rol.upper()}", size=20, weight="bold", text_align=ft.TextAlign.CENTER),
            container_id,
            ft.Container(height=10),
            txt_nombre,
            txt_doc,
            txt_pass,
        ]

        # Campos dinámicos
        dd_empresa = None
        txt_costo = None
        txt_salario = None
        txt_extra = None

        if rol == "tecnico":
            dd_empresa = ft.Dropdown(
                label="Empresa Vinculada", border_radius=10, 
                options=[ft.dropdown.Option("Apex"), ft.dropdown.Option("Externo")],
                value="Apex"
            )
            txt_costo = ft.TextField(
                label="Costo Servicio ($)", border_radius=10, 
                keyboard_type=ft.KeyboardType.NUMBER, value="0"
            )
            controles.extend([dd_empresa, txt_costo])
            
        elif rol == "empleado":
            txt_salario = ft.TextField(
                label="Salario Base ($)", border_radius=10, expand=True,
                keyboard_type=ft.KeyboardType.NUMBER, value="0"
            )
            txt_extra = ft.TextField(
                label="Valor Hora Extra ($)", border_radius=10, expand=True,
                keyboard_type=ft.KeyboardType.NUMBER, value="0"
            )
            controles.append(ft.Row([txt_salario, txt_extra], spacing=10))

        def guardar_clic(e):
            if not hasattr(self.page, 'sesion') or not self.page.sesion.verificar():
                    self.volver_callback(None)
                    return
            if not txt_nombre.value:
                self.page.snack_bar = ft.SnackBar(ft.Text("❌ El nombre es obligatorio"), bgcolor="#B71C1C")
                self.page.snack_bar.open = True
                self.page.update()
                return

            # Deshabilitar botón para evitar doble clic
            e.control.disabled = True
            e.control.text = "PROCESANDO..."
            self.page.update()
                
            datos = {
                "nombre": txt_nombre.value, 
                "doc": txt_doc.value or "",
                "user": nuevo_id,
                "pass": txt_pass.value or "1234",
                "rol": rol, 
                "id_interno": nuevo_id,
                "empresa": dd_empresa.value if dd_empresa else "APEX",
                "costo": float(txt_costo.value.replace(",","") if txt_costo and txt_costo.value else 0),
                "salario": float(txt_salario.value.replace(",","") if txt_salario and txt_salario.value else 0),
                "extra": float(txt_extra.value.replace(",","") if txt_extra and txt_extra.value else 0)
            }
            
            # Ejecución en base de datos
            exito = self.db.registrar_usuario_full_pro(datos)
            
            if exito:
                self.page.snack_bar = ft.SnackBar(ft.Text("✅ Usuario creado exitosamente"), bgcolor="#1B5E20")
                self.page.snack_bar.open = True
                self.mostrar_maestro_personal()
            else:
                e.control.disabled = False
                e.control.text = "CREAR CUENTA"
                self.page.snack_bar = ft.SnackBar(ft.Text("❌ Error al guardar en Supabase"), bgcolor="#B71C1C")
                self.page.snack_bar.open = True
                self.page.update()

        btn_guardar = ft.ElevatedButton(
            "CREAR CUENTA", bgcolor="black", color="white", height=50, on_click=guardar_clic
        )

        controles.append(ft.Container(height=10))
        controles.append(btn_guardar)
        controles.append(ft.TextButton("Cancelar", on_click=lambda _: self.abrir_formulario_usuario()))

        form_card = ft.Container(
            content=ft.Column(controles, horizontal_alignment=ft.CrossAxisAlignment.STRETCH, spacing=15),
            bgcolor="white", padding=35, border_radius=20, border=ft.border.all(1, "#E0E0E0")
        )

        self.page.add(self.zona_segura(form_card, col_size={"sm": 12, "md": 9, "lg": 5}))
        self.page.update()