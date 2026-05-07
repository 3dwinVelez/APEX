"""
APEX — Orquestador
El director del equipo. Recibe tu solicitud y coordina todos los agentes
en el orden correcto, pausando siempre en los puntos de aprobación humana.
"""

import os
import sys
from pathlib import Path

# Agentes
sys.path.insert(0, str(Path(__file__).parent))
from advisors    import orientar
from interpreter import interpretar
from validator   import validar, MAX_INTENTOS
from architect   import documentar

# ── Flujo principal ────────────────────────────────────────────────────────────

def ejecutar_flujo(solicitud: str):
    """
    Flujo completo del equipo de agentes con puntos de aprobación humana.
    
    PASO 1: Orientación (impacto + alternativas) → TÚ APRUEBAS
    PASO 2: Interpretación (spec técnica)        → TÚ APRUEBAS
    PASO 3: Codificación (simulada por ahora)    → TÚ REVISAS
    PASO 4: Validación (3 capas)                 → TÚ APRUEBAS
    PASO 5: Documentación (arquitecto)           → CIERRA EL CICLO
    """

    separador = "=" * 60

    print(f"\n{separador}")
    print("APEX — EQUIPO DE AGENTES")
    print(f"Solicitud: {solicitud}")
    print(separador)

    # ── PASO 1: ORIENTACIÓN ────────────────────────────────────────────────────
    print("\n📍 PASO 1 DE 5 — ORIENTACIÓN")
    reporte = orientar(solicitud)

    decision = _pedir_decision(
        opciones={
            "1": "Continuar con la solicitud original",
            "2": "Ajustar según la alternativa sugerida",
            "3": "Cancelar"
        }
    )

    if decision == "3":
        print("\n⛔ Flujo cancelado por el líder.")
        return

    if decision == "2":
        print("\nDescribe el ajuste que quieres aplicar:")
        solicitud = input("> ").strip()
        print(f"\n✅ Solicitud ajustada: {solicitud}")

    # ── PASO 2: INTERPRETACIÓN ─────────────────────────────────────────────────
    print(f"\n{separador}")
    print("📍 PASO 2 DE 5 — INTERPRETACIÓN")
    spec = interpretar(solicitud)

    print(f"\n{separador}")
    print("SPEC TÉCNICA GENERADA:")
    print(separador)
    print(spec)
    print(separador)

    decision = _pedir_decision(
        opciones={
            "1": "Aprobar spec y continuar",
            "2": "Rechazar y replantear la solicitud",
        }
    )

    if decision == "2":
        print("\n⛔ Spec rechazada. Reinicia el flujo con una solicitud más clara.")
        return

    # ── PASO 3: CÓDIGO ─────────────────────────────────────────────────────────
    print(f"\n{separador}")
    print("📍 PASO 3 DE 5 — CÓDIGO")
    print(separador)
    print("El Agente Coder generaría el código aquí.")
    print("Por ahora, pega el código que quieres validar")
    print("(termina con '---END---'):")

    code_lines = []
    while True:
        line = input()
        if line == "---END---":
            break
        code_lines.append(line)
    codigo = "\n".join(code_lines)

    # ── PASO 4: VALIDACIÓN ─────────────────────────────────────────────────────
    print(f"\n{separador}")
    print("📍 PASO 4 DE 5 — VALIDACIÓN")

    intento = 1
    aprobado = False

    while intento <= MAX_INTENTOS and not aprobado:
        resultado = validar(codigo, spec, intento)

        print(f"\n{separador}")
        print("RESULTADO DE VALIDACIÓN:")
        print(separador)
        print(resultado["resultado"])
        print(separador)

        if resultado.get("escalado"):
            print("\n⚠️  El código fue escalado a revisión humana directa.")
            print("Por favor revisa manualmente antes de continuar.")
            decision = _pedir_decision(
                opciones={
                    "1": "Aprobar manualmente y continuar",
                    "2": "Cancelar el flujo"
                }
            )
            if decision == "2":
                return
            aprobado = True
            break

        if resultado["aprobado"]:
            aprobado = True
            print("\n✅ Código aprobado por el Validador.")
        else:
            print(f"\n❌ Validación fallida (intento {intento}/{MAX_INTENTOS})")
            if intento < MAX_INTENTOS:
                print("El Coder debería corregir según las instrucciones.")
                print("Pega el código corregido (termina con '---END---'):")
                code_lines = []
                while True:
                    line = input()
                    if line == "---END---":
                        break
                    code_lines.append(line)
                codigo = "\n".join(code_lines)
            intento += 1

    if not aprobado:
        print("\n⛔ El código no pasó validación. Flujo detenido.")
        return

    # Aprobación final del líder
    print(f"\n{separador}")
    print("⏸  APROBACIÓN FINAL REQUERIDA")
    print(separador)
    print("El Validador aprobó el código. ¿Lo aplicamos al proyecto?")

    decision = _pedir_decision(
        opciones={
            "1": "Aprobar y documentar",
            "2": "Rechazar"
        }
    )

    if decision == "2":
        print("\n⛔ Cambio rechazado por el líder.")
        return

    # ── PASO 5: DOCUMENTACIÓN ──────────────────────────────────────────────────
    print(f"\n{separador}")
    print("📍 PASO 5 DE 5 — DOCUMENTACIÓN")

    print("\nNotas adicionales para el Arquitecto (opcional, Enter para omitir):")
    notas = input("> ").strip()

    resultado_doc = documentar(solicitud, spec, codigo, notas)

    print(f"\n{separador}")
    print("✅ FLUJO COMPLETADO")
    print(separador)
    print(f"📁 Documentación guardada en: {resultado_doc['archivo']}")
    print("La memoria de APEX ha sido actualizada.")
    print(separador)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _pedir_decision(opciones: dict) -> str:
    """Pausa el flujo y espera decisión del líder."""
    print("\n⏸  TU DECISIÓN ES NECESARIA:")
    for key, descripcion in opciones.items():
        print(f"  [{key}] {descripcion}")

    while True:
        eleccion = input("\nElige una opción: ").strip()
        if eleccion in opciones:
            print(f"\n✅ Seleccionaste: {opciones[eleccion]}")
            return eleccion
        print(f"Opción inválida. Elige entre: {', '.join(opciones.keys())}")

# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("APEX — ORQUESTADOR DEL EQUIPO DE AGENTES")
    print("=" * 60)

    if len(sys.argv) > 1:
        solicitud = " ".join(sys.argv[1:])
    else:
        print("\nEscribe tu solicitud para el equipo APEX:")
        solicitud = input("> ").strip()

    ejecutar_flujo(solicitud)
