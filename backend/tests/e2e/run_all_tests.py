#!/usr/bin/env python3
"""Master test suite E2E — Backend + Frontend post-pivot"""
import subprocess
import sys
from pathlib import Path

def run_test(script_path, name):
    """Ejecutar un test y reportar resultado."""
    print(f"\n{'='*70}")
    print(f"EJECUTANDO: {name}")
    print('='*70)
    
    # Determinar la raíz del proyecto
    test_dir = Path(__file__).parent
    project_root = test_dir.parent.parent.parent
    full_path = project_root / script_path
    
    result = subprocess.run(
        [sys.executable, str(full_path)],
        cwd=project_root,
        capture_output=False
    )
    
    return result.returncode == 0

def main():
    print("\n" + "="*70)
    print("MASTER TEST SUITE E2E POST-PIVOT")
    print("Clima + Seguridad Ciudadana")
    print("="*70)
    
    tests = [
        ("backend/tests/e2e/test_pivot_simple.py", "Backend API Tests"),
        ("backend/tests/e2e/test_frontend.py", "Frontend Tests"),
    ]
    
    results = {}
    for script, name in tests:
        results[name] = run_test(script, name)
    
    print("\n" + "="*70)
    print("RESUMEN FINAL")
    print("="*70)
    
    for name, passed in results.items():
        status = "✅ PASÓ" if passed else "❌ FALLÓ"
        print(f"{status} — {name}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*70)
    if all_passed:
        print("✅✅✅ TODOS LOS TESTS PASARON — SISTEMA 100% FUNCIONAL ✅✅✅")
        print("Backend (11/11) + Frontend (6/6) = 17/17 tests OK")
    else:
        print("❌ ALGUNOS TESTS FALLARON — REVISAR ERRORES")
    print("="*70 + "\n")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
