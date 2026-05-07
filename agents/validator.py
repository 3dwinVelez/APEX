"""
APEX — Agente Validador
Audita el código generado en 3 capas antes de aprobarlo.
Capa 1: Sintaxis y calidad técnica
Capa 2: Integración (¿rompe algo existente?)
Capa 3: Lógica de negocio APEX
"""

import os
import chromadb
from pathlib import Path
from anthropic import Anthropic

# ── Configuración ──────────────────────────────────────────────────────────────

CHROMA_DIR   = Path(__file__).parent / "memory" / "chroma_db"
COLLECTION   = "apex_knowledge"
APEX_MODEL   = "claude-haiku-4-5-20251001"
MAX_INTENTOS = 3

# ── Clientes ───────────────────────────────────────────────────────────────────

anthropic  = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
chroma     = chromadb.PersistentClient(path=str(CHROMA_DIR))
collection = chroma.get_collection(COLLECTION)

# ── Memoria ────────────────────────────────────────────────────────────────────

def consultar_memoria(query: str, n_results: int = 3) -> str:
    results = collection.query(query_texts=[query], n_results=n_results)
    fragmentos = []
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        fragmentos.append(f"[{meta['tipo'].upper()}]\n{doc}")
    return "\n\n---\n\n".join(fragmentos)

# ── Prompt del Validador ───────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres el Agente Validador del equipo de desarrollo de APEX.

Tu responsabilidad es auditar código en 3 capas y emitir un veredicto claro.

STACK DE APEX:
- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: FastAPI (Python)
- Base de datos: PostgreSQL

CAPA 1 — SINTAXIS Y CALIDAD:
- ¿El código es sintácticamente correcto?
- ¿Sigue las convenciones de TypeScript/Python?
- ¿Usa Tailwind CSS (no CSS inline ni módulos propios)?
- ¿Evita hardcodear URLs, credenciales o valores que deberían estar en constants?

CAPA 2 — INTEGRACIÓN:
- ¿Puede romper módulos existentes?
- ¿Respeta los archivos declarados como intocables en la spec?
- ¿Es compatible con el DataContext y los hooks compartidos?
- ¿Los imports son correctos y existen los módulos referenciados?

CAPA 3 — LÓGICA DE NEGOCIO:
- ¿Cumple las reglas de negocio de APEX?
- ¿Usa soft delete (nunca eliminación física)?
- ¿Respeta el sistema de permisos (permissions.js)?
- ¿Es consistente con la arquitectura del proyecto?

FORMATO DE RESPUESTA OBLIGATORIO:

---
## RESULTADO DE VALIDACIÓN

**Intento número:** [N]

### Capa 1 — Sintaxis y calidad
- Estado: ✅ APROBADO / ❌ RECHAZADO
- Observaciones: [detalles]

### Capa 2 — Integración
- Estado: ✅ APROBADO / ❌ RECHAZADO
- Observaciones: [detalles]

### Capa 3 — Lógica de negocio
- Estado: ✅ APROBADO / ❌ RECHAZADO
- Observaciones: [detalles]

### Veredicto final: ✅ APROBADO / ❌ RECHAZADO

**Instrucciones de corrección:** (solo si es rechazado)
1. [instrucción específica y accionable]
2. [instrucción específica y accionable]
---

Sé preciso. Si algo está bien, apruébalo. Si algo está mal, explica exactamente qué corregir.
"""

# ── Agente Validador ───────────────────────────────────────────────────────────

def validar(codigo: str, spec: str, intento: int = 1) -> dict:
    """
    Valida código en 3 capas.
    Retorna dict con: aprobado (bool), resultado (str), intento (int)
    """
    print(f"\n🔍 Validador — Auditoría capa por capa (intento {intento}/{MAX_INTENTOS})")

    if intento > MAX_INTENTOS:
        print("⚠️  Máximo de intentos alcanzado. Escalando a revisión humana.")
        return {
            "aprobado": False,
            "resultado": "ESCALADO: El código no pasó validación en 3 intentos. Requiere revisión humana.",
            "intento": intento,
            "escalado": True
        }

    contexto = consultar_memoria("reglas de negocio convenciones APEX permisos")

    mensaje = f"""SPEC TÉCNICA ORIGINAL:
{spec}

CÓDIGO A VALIDAR:
{codigo}

CONTEXTO DE REGLAS APEX:
{contexto}

Intento número: {intento}

Audita este código en las 3 capas y emite tu veredicto."""

    response = anthropic.messages.create(
        model=APEX_MODEL,
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": mensaje}]
    )

    resultado = response.content[0].text
    aprobado  = "Veredicto final: ✅ APROBADO" in resultado or "APROBADO" in resultado.split("Veredicto final:")[-1]

    return {
        "aprobado": aprobado,
        "resultado": resultado,
        "intento": intento,
        "escalado": False
    }

# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("APEX — Agente Validador")
    print("=" * 60)
    print("\nEste agente recibe código y una spec técnica.")
    print("Ingresa la spec (termina con '---END---'):")

    spec_lines = []
    while True:
        line = input()
        if line == "---END---":
            break
        spec_lines.append(line)
    spec = "\n".join(spec_lines)

    print("\nIngresa el código a validar (termina con '---END---'):")
    code_lines = []
    while True:
        line = input()
        if line == "---END---":
            break
        code_lines.append(line)
    codigo = "\n".join(code_lines)

    resultado = validar(codigo, spec)

    print("\n" + "=" * 60)
    print("RESULTADO DE VALIDACIÓN:")
    print("=" * 60)
    print(resultado["resultado"])
    print("=" * 60)
    print(f"✅ APROBADO" if resultado["aprobado"] else "❌ RECHAZADO")
