import flet as ft

class PersonalModule:
    def __init__(self, page, db, sesion, volver_callback):
        self.page = page
        self.db = db
        self.sesion = sesion
        self.volver_callback = volver_callback

   # --- modules/personal.py (Fragmento corregido) ---
    def mostrar_maestro_personal(self, e=None):
        self.page.clean()
        colaboradores = self.db.obtener_lista_personal()
        lista_p = ft.Column(spacing=10, horizontal_alignment="center")
        
        for p in colaboradores:
            nom = str(p[0])
            lista_p.controls.append(
                ft.Container(
                    content=ft.Row([
                        ft.Text("👤", size=20),
                        ft.Column([
                            ft.Text(nom, weight="bold", size=16),
                            ft.Text(f"{str(p[1]).upper()} • Base: ${p[2]}", size=12, color="grey"),
                        ], expand=True, spacing=2),
                        ft.TextButton(
                            content=ft.Text("EDITAR", size=10, weight="bold", color="blue"),
                            on_click=lambda _, n=nom: self.abrir_formulario_usuario(n)
                        )
                    ]),
                    padding=15, bgcolor="white", border_radius=10, border=ft.border.all(1, "#E0E0E0"), width=380
                )
            )

        self.page.add(
            ft.Column([
                ft.Container(height=10),
                ft.Row([
                    ft.TextButton(content=ft.Text(" < VOLVER ", weight="bold", color="blue"), 
                                  on_click=lambda _: self.volver_callback(self.sesion["usuario"])),
                    ft.Text("GESTIÓN DE PERSONAL", weight="bold", size=20),
                ], alignment="center", width=400),
                ft.Container(height=1, width=380, bgcolor="#E0E0E0"),
                ft.ElevatedButton("+ CREAR NUEVO USUARIO", bgcolor="blue", color="white", width=380, height=50, 
                                  on_click=lambda _: self.abrir_formulario_usuario()),
                ft.Container(height=10),
                ft.Text("COLABORADORES REGISTRADOS", size=11, weight="bold", color="grey"),
                ft.Container(content=ft.ListView(controls=[lista_p], height=400, spacing=10), width=400)
            ], horizontal_alignment="center", width=450)
        )
        self.page.update()

    def abrir_formulario_usuario(self, nombre_edit=None):
        self.page.clean()
        titulo = "MODIFICAR EMPLEADO" if nombre_edit else "NUEVO COLABORADOR"
        txt_nombre = ft.TextField(label="Nombre Completo", width=380, border_radius=10, value=nombre_edit if nombre_edit else "")
        txt_user = ft.TextField(label="Usuario", width=182, border_radius=10)
        txt_pass = ft.TextField(label="Pass", width=182, password=True, border_radius=10)
        dd_rol = ft.Dropdown(label="Rol", width=380, border_radius=10, options=[ft.dropdown.Option("admin"), ft.dropdown.Option("tecnico")])
        txt_pago = ft.TextField(label="Salario Base ($)", width=380, border_radius=10)

        def guardar_evt(e):
            salario_val = float(txt_pago.value) if txt_pago.value else 0.0
            if nombre_edit:
                exito = self.db.actualizar_usuario(nombre_edit, txt_nombre.value, dd_rol.value, salario_val)
            else:
                exito = self.db.registrar_usuario_full(txt_nombre.value, txt_user.value, txt_pass.value, dd_rol.value, salario_val)
            if exito: self.mostrar_maestro_personal()

        def eliminar_evt(e):
            if self.db.eliminar_usuario(nombre_edit): self.mostrar_maestro_personal()

        botones = [ft.ElevatedButton("GUARDAR", bgcolor="blue", color="white", width=380, on_click=guardar_evt)]
        if nombre_edit:
            botones.append(ft.ElevatedButton("ELIMINAR", bgcolor="red", color="white", width=380, on_click=eliminar_evt))
        botones.append(ft.TextButton("Cancelar", on_click=lambda _: self.mostrar_maestro_personal()))

        self.page.add(ft.Column([ft.Text(titulo, size=22, weight="bold"), txt_nombre, ft.Row([txt_user, txt_pass], width=380), dd_rol, txt_pago, ft.Column(botones)], horizontal_alignment="center", spacing=15))
        self.page.update()