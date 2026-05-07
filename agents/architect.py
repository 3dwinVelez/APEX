"""
APEX — Agente Arquitecto
Documenta cada cambio aprobado y actualiza la base de conocimiento.
Solo se activa después de que el Validador aprueba y el humano confirma.
"""

import os
import json
import chromadb
from pathlib import Path
from datetime import datetime
from anthropic import Anthropic

# ── Configuración ──────────────────────────────────────────────────────────────

CHROMA_DIR    = Path(__file__).parent / "memory" / "chroma_db"
KNOWLEDGE_DIR = Path(__file__).parent.parent / "apex-knowledge"
COLLECTION    = "apex_knowledge"
APEX_MODEL    = "claude-haiku-4-5-20251001"
REGISTRO_DIR  = KNOWLEDGE_DIR / "06-estado-actual" / "registros"

# ── Clientes ───────────────────────────────────────────────────────────────────

anthropic  = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
chroma     = chromadb.PersistentClient(path=str(CHROMA_DIR))
collection = chroma.get_collection(COLLECTION)

# ── Prompt del Arquitecto ──────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres el Agente Arquitecto del equipo de desarrollo de APEX.

Tu responsabilidad es documentar cada cambio aprobado en formato legible para agentes de IA.

Recibirás:
- La solicitud original del usuario
- La spec técnica que se generó
- El código que fue implementado y validado
- Notas adicionales del líder

Debes generar un documento de registro con esta estructura exacta:

---
## Registro de Interacción APEX

**Fecha:** [fecha actual]
**Tipo:** creacion / modificacion / correccion
**Módulo afectado:** [nombre]
**Solicitado por:** humano
**Aprobado por:** supervisor humano

### Solicitud original
[descripción en lenguaje natural de lo que se pidió]

### Decisión técnica tomada
[qué se implementó y por qué]

### Archivos afectados
- Creados: [lista]
- Modificados: [lista]
- Intocados: [lista]

### Reglas de negocio aplicadas
[qué reglas de APEX se tuvieron en cuenta]

### Lo que los agentes deben saber
[contexto importante para futuras interacciones relacionadas]

### Pendientes relacionados
[si quedó algo por hacer en el futuro]

### Palabras clave
[lista de términos para facilitar búsqueda semántica futura]
---

Usa lenguaje claro, preciso y orientado a que una IA lo entienda en el futuro.
"""

# ── Agente Arquitecto ──────────────────────────────────────────────────────────

def documentar(
    solicitud: str,
    spec: str,
    codigo: str,
    notas_lider: str = ""
) -> dict:
    """
    Genera documentación del cambio y la persiste en la base de conocimiento.
    Retorna dict con: documento (str), archivo (str)
    """
    print("\n📐 Arquitecto — Generando documentación del cambio...")

    mensaje = f"""SOLICITUD ORIGINAL:
{solicitud}

SPEC TÉCNICA:
{spec}

CÓDIGO IMPLEMENTADO:
{codigo}

NOTAS DEL LÍDER:
{notas_lider if notas_lider else "Sin notas adicionales."}

Genera el documento de registro para esta interacción."""

    response = anthropic.messages.create(
        model=APEX_MODEL,
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": mensaje}]
    )

    documento = response.content[0].text

    # Guardar en /apex-knowledge/06-estado-actual/registros/
    REGISTRO_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_archivo = f"registro_{timestamp}.md"
    ruta_archivo   = REGISTRO_DIR / nombre_archivo

    ruta_archivo.write_text(documento, encoding="utf-8")
    print(f"   ✅ Documento guardado: {ruta_archivo}")

    # Re-ingestar el nuevo documento en ChromaDB
    _actualizar_memoria(documento, nombre_archivo, ruta_archivo)

    return {
        "documento": documento,
        "archivo": str(ruta_archivo)
    }

def _actualizar_memoria(documento: str, nombre: str, ruta: Path):
    """Agrega el nuevo documento a ChromaDB sin re-ingestar todo."""
    print("   🔄 Actualizando memoria vectorial...")

    chunk_size = 800
    chunks = [documento[i:i+chunk_size] for i in range(0, len(documento), chunk_size)]

    for i, chunk in enumerate(chunks):
        if not chunk.strip():
            continue
        collection.upsert(
            ids=[f"{ruta.stem}__chunk_{i}"],
            documents=[chunk],
            metadatas=[{
                "archivo": nombre,
                "carpeta": "06-estado-actual",
                "tipo":    "registro",
                "ruta":    str(ruta),
                "chunk_index": i
            }]
        )

    print(f"   ✅ Memoria actualizada con {len(chunks)} fragmentos nuevos")

# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("APEX — Agente Arquitecto")
    print("=" * 60)

    print("\nSolicitud original:")
    solicitud = input("> ").strip()

    print("\nSpec técnica (termina con '---END---'):")
    spec_lines = []
    while True:
        line = input()
        if line == "---END---":
            break
        spec_lines.append(line)
    spec = "\n".join(spec_lines)

    print("\nCódigo implementado (termina con '---END---'):")
    code_lines = []
    while True:
        line = input()
        if line == "---END---":
            break
        code_lines.append(line)
    codigo = "\n".join(code_lines)

    print("\nNotas del líder (opcional, Enter para omitir):")
    notas = input("> ").strip()

    resultado = documentar(solicitud, spec, codigo, notas)

    print("\n" + "=" * 60)
    print("DOCUMENTO GENERADO:")
    print("=" * 60)
    print(resultado["documento"])
    print("=" * 60)
    print(f"📁 Guardado en: {resultado['archivo']}")
