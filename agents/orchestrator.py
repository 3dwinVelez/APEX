"""
APEX — Orquestador
El director del equipo. Coordina todos los agentes en orden
con puntos de aprobación humana en cada transición.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from advisors    import orientar
from interpreter import interpretar
from coder       import codear
from validator   import validar, MAX_INTENTOS
from architect   import documentar

# ── Flujo principal ────────────────────────────────────────────────────────────

def ejecutar_flujo(solicitud: str):
    separador = "=" * 60

    print(f"\n{separador}")
    print("APEX — EQUIPO DE AGENTES")
    print(f"Solicitud: {solicitud}")
    print(separador)

    # ── PASO 1: ORIENTACIÓN ────────────────────────────────────────────────────
    print("\n📍 PASO 1 DE 5 — ORIENTACIÓN")
    reporte = orientar(solicitud)

    decision = _pedir_decision({
        "1": "Continuar con la solicitud original",
        "2": "Ajustar según la alternativa sugerida",
        "3": "Cancelar"
    })

    if decision == "3":
        print("\n⛔ Flujo cancelado.")
        return

    if decision == "2":
        print("\nDescribe el ajuste:")
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

    decision = _pedir_decision({
        "1": "Aprobar spec y continuar",
        "2": "Rechazar y replantear",
    })

    if decision == "2":
        print("\n⛔ Spec rechazada.")
        return

    # ── PASO 3: GENERACIÓN DE CÓDIGO ──────────────────────────────────────────
    print(f"\n{separador}")
    print("📍 PASO 3 DE 5 — GENERACIÓN DE CÓDIGO")
    print(separador)

    archivos_generados = codear(spec, solicitud)

    if not archivos_generados:
        print("\n⛔ No se generó ningún archivo. Flujo detenido.")
        return

    codigo = "\n\n".join(
        f"// ── {ruta} ──\n{c}"
        for ruta, c in archivos_generados.items()
    )

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
            print("\n⚠️  Escalado a revisión humana.")
            decision = _pedir_decision({
                "1": "Aprobar manualmente y continuar",
                "2": "Cancelar"
            })
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
                print("\n  [1] Coder regenera automáticamente")
                print("  [2] Pego el código corregido manualmente")
                while True:
                    modo = input("\nElige: ").strip()
                    if modo in ("1", "2"):
                        break

                if modo == "1":
                    solicitud_corregida = f"{solicitud} | CORRECCIONES: {resultado['resultado'][:300]}"
                    archivos_generados = codear(spec, solicitud_corregida)
                    if not archivos_generados:
                        print("\n⛔ No se generó código. Flujo detenido.")
                        return
                    codigo = "\n\n".join(
                        f"// ── {ruta} ──\n{c}"
                        for ruta, c in archivos_generados.items()
                    )
                else:
                    print("Pega el código corregido (---END---):")
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

    print(f"\n{separador}")
    print("⏸  APROBACIÓN FINAL")
    print(separador)

    decision = _pedir_decision({
        "1": "Aprobar y documentar",
        "2": "Rechazar"
    })

    if decision == "2":
        print("\n⛔ Cambio rechazado.")
        return

    # ── PASO 5: DOCUMENTACIÓN ──────────────────────────────────────────────────
    print(f"\n{separador}")
    print("📍 PASO 5 DE 5 — DOCUMENTACIÓN")

    print("\nNotas para el Arquitecto (opcional, Enter para omitir):")
    notas = input("> ").strip()

    resultado_doc = documentar(solicitud, spec, codigo, notas)

    print(f"\n{separador}")
    print("✅ FLUJO COMPLETADO")
    print(separador)
    print(f"📁 Guardado en: {resultado_doc['archivo']}")
    print("La memoria de APEX ha sido actualizada.")
    print(separador)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _pedir_decision(opciones: dict) -> str:
    print("\n⏸  TU DECISIÓN ES NECESARIA:")
    for key, desc in opciones.items():
        print(f"  [{key}] {desc}")
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
        print("\nEscribe tu solicitud:")
        solicitud = input("> ").strip()

    ejecutar_flujo(solicitud)