"""
APEX — Agente Coder
Genera código archivo por archivo basándose en la spec técnica del Intérprete.
Cada archivo es aprobado por el líder antes de continuar con el siguiente.
"""

import os
import re
import chromadb
from pathlib import Path
from anthropic import Anthropic

# ── Configuración ──────────────────────────────────────────────────────────────

CHROMA_DIR  = Path(__file__).parent / "memory" / "chroma_db"
COLLECTION  = "apex_knowledge"
APEX_MODEL  = "claude-haiku-4-5-20251001"

# ── Clientes ───────────────────────────────────────────────────────────────────

anthropic  = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
chroma     = chromadb.PersistentClient(path=str(CHROMA_DIR))
collection = chroma.get_collection(COLLECTION)

# ── Funciones de memoria ───────────────────────────────────────────────────────

def consultar_memoria(query: str, n_results: int = 5) -> str:
    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )
    fragmentos = []
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        fragmentos.append(f"[{meta['tipo'].upper()} — {meta['archivo']}]\n{doc}")
    return "\n\n---\n\n".join(fragmentos)

# ── Parseo de archivos desde la spec ──────────────────────────────────────────

def extraer_archivos_de_spec(spec: str) -> list:
    archivos = []

    patron_crear = r"(?i)\*\*archivos a crear:\*\*\s*(.*?)(?=\*\*archivos a modificar|\*\*archivos intocables|\*\*convenciones|$)"
    match_crear = re.search(patron_crear, spec, re.DOTALL)
    if match_crear:
        bloque = match_crear.group(1).strip()
        for linea in bloque.splitlines():
            linea = linea.strip().lstrip("-").strip()
            if linea and "—" in linea:
                partes = linea.split("—", 1)
                archivos.append({
                    "ruta": partes[0].strip(),
                    "accion": "crear",
                    "descripcion": partes[1].strip()
                })

    patron_modificar = r"(?i)\*\*archivos a modificar:\*\*\s*(.*?)(?=\*\*archivos intocables|\*\*convenciones|$)"
    match_modificar = re.search(patron_modificar, spec, re.DOTALL)
    if match_modificar:
        bloque = match_modificar.group(1).strip()
        for linea in bloque.splitlines():
            linea = linea.strip().lstrip("-").strip()
            if linea and "—" in linea:
                partes = linea.split("—", 1)
                archivos.append({
                    "ruta": partes[0].strip(),
                    "accion": "modificar",
                    "descripcion": partes[1].strip()
                })

    return archivos

# ── Prompt del Coder ───────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres el Agente Coder del equipo de desarrollo de APEX.

Tu única responsabilidad es generar código de alta calidad para UN archivo específico,
basándote en la spec técnica del Intérprete y el contexto de la base de conocimiento.

APEX es un ERP SaaS con:
- Frontend: Next.js + TypeScript + Tailwind CSS (migrando desde React con JSX)
- Backend: FastAPI (Python)
- Base de datos: PostgreSQL

REGLAS ABSOLUTAS que debes respetar siempre:
- Nunca eliminar registros físicamente (siempre soft delete con campo activo/deleted_at)
- No modificar permissions.js sin indicarlo explícitamente
- Solo Tailwind CSS para estilos — sin CSS inline ni archivos CSS custom
- No hardcodear URLs ni credenciales — usar variables de entorno o constantes
- Verificar si el componente ya existe en shared/ui.jsx antes de crearlo
- Formato ISO 8601 (YYYY-MM-DD) para todas las fechas
- Imports ordenados: librerías externas primero, luego internos

FORMATO DE RESPUESTA:
Responde ÚNICAMENTE con el bloque de código del archivo solicitado.
No agregues explicaciones antes ni después.
Usa bloques de código con el lenguaje correcto.
"""

# ── Generador por archivo ──────────────────────────────────────────────────────

def generar_archivo(archivo, spec, solicitud, codigo_previo):
    contexto_memoria = consultar_memoria(f"{solicitud} {archivo['ruta']}")

    contexto_previo = ""
    if codigo_previo:
        contexto_previo = "\n\nARCHIVOS YA GENERADOS EN ESTE CICLO:\n"
        for ruta, codigo in codigo_previo.items():
            contexto_previo += f"\n--- {ruta} ---\n{codigo}\n"

    accion_texto = "Crea este archivo desde cero" if archivo["accion"] == "crear" else "Modifica este archivo existente"

    mensaje = f"""SOLICITUD ORIGINAL:
{solicitud}

SPEC TÉCNICA COMPLETA:
{spec}

ARCHIVO A TRABAJAR:
- Ruta: {archivo['ruta']}
- Acción: {archivo['accion'].upper()}
- Descripción: {archivo['descripcion']}

{accion_texto}. Genera ÚNICAMENTE el código de este archivo.

CONTEXTO DE APEX (base de conocimiento):
{contexto_memoria}
{contexto_previo}"""

    response = anthropic.messages.create(
        model=APEX_MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": mensaje}]
    )

    return response.content[0].text

# ── Extractor de código limpio ─────────────────────────────────────────────────

def extraer_codigo_limpio(respuesta):
    patron = r"```(?:\w+)?\n([\s\S]*?)```"
    match = re.search(patron, respuesta)
    if match:
        return match.group(1).strip()
    return respuesta.strip()

# ── Agente Coder principal ─────────────────────────────────────────────────────

def codear(spec, solicitud):
    separador = "=" * 60

    print(f"\n{separador}")
    print("🤖 APEX — Agente Coder")
    print(separador)

    archivos = extraer_archivos_de_spec(spec)

    if not archivos:
        print("\n⚠️  No se encontraron archivos en la spec. Pega el código manualmente (---END---):")
        code_lines = []
        while True:
            line = input()
            if line == "---END---":
                break
            code_lines.append(line)
        return {"manual": "\n".join(code_lines)}

    print(f"\n📋 Archivos identificados: {len(archivos)}")
    for i, arch in enumerate(archivos, 1):
        print(f"  {i}. [{arch['accion'].upper()}] {arch['ruta']}")

    codigo_aprobado = {}

    for i, archivo in enumerate(archivos, 1):
        print(f"\n{separador}")
        print(f"📝 ARCHIVO {i} DE {len(archivos)}: [{archivo['accion'].upper()}] {archivo['ruta']}")
        print(separador)

        intentos = 0
        aprobado = False

        while not aprobado and intentos < 3:
            intentos += 1

            if intentos > 1:
                print(f"\n🔄 Regenerando (intento {intentos}/3)...")
                print("Describe qué debe corregirse:")
                correccion = input("> ").strip()
                archivo["descripcion"] += f" | CORRECCIÓN: {correccion}"

            print("\n⚙️  Generando código...")
            respuesta = generar_archivo(archivo, spec, solicitud, codigo_aprobado)
            codigo_limpio = extraer_codigo_limpio(respuesta)

            print(f"\n{separador}")
            print(f"CÓDIGO — {archivo['ruta']}")
            print(separador)
            print(codigo_limpio)
            print(separador)

            print("\n⏸  ¿Apruebas este archivo?")
            print("  [1] Sí, continuar")
            print("  [2] No, regenerar con correcciones")
            print("  [3] Cancelar todo")

            while True:
                decision = input("\nElige: ").strip()
                if decision in ("1", "2", "3"):
                    break

            if decision == "1":
                codigo_aprobado[archivo["ruta"]] = codigo_limpio
                print(f"\n✅ {archivo['ruta']} aprobado.")
                aprobado = True

            elif decision == "2":
                if intentos >= 3:
                    print("\n⚠️  Límite de intentos alcanzado.")
                    print("  [1] Continuar sin este archivo")
                    print("  [2] Cancelar el flujo")
                    d = input("Elige: ").strip()
                    if d == "2":
                        return codigo_aprobado
                    aprobado = True

            elif decision == "3":
                print("\n⛔ Flujo cancelado.")
                return codigo_aprobado

    print(f"\n{separador}")
    print(f"✅ Coder completado — {len(codigo_aprobado)} archivo(s) generado(s)")
    print(separador)

    return codigo_aprobado


if __name__ == "__main__":
    print("=" * 60)
    print("APEX — Agente Coder (modo independiente)")
    print("=" * 60)
    print("\nPega la spec técnica (---END---):")
    spec_lines = []
    while True:
        line = input()
        if line == "---END---":
            break
        spec_lines.append(line)
    spec = "\n".join(spec_lines)
    print("\nSolicitud original:")
    solicitud = input("> ").strip()
    resultado = codear(spec, solicitud)
    for ruta, codigo in resultado.items():
        print(f"\n--- {ruta} ---\n{codigo}")