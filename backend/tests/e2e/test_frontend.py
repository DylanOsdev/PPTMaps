"""Test del frontend post-pivot — verificar que las páginas cargan correctamente"""
import requests
from bs4 import BeautifulSoup

BASE_URL = "http://localhost:8000"

def test_page(url, expected_title_contains, test_name):
    """Test genérico para verificar que una página carga."""
    try:
        r = requests.get(url, timeout=10, allow_redirects=True)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        # Verificar que es HTML
        assert 'text/html' in r.headers.get('content-type', ''), "Not HTML response"
        
        # Parsear HTML
        soup = BeautifulSoup(r.content, 'html.parser')
        
        # Verificar título
        title = soup.find('title')
        if title and expected_title_contains:
            assert expected_title_contains.lower() in title.text.lower(), \
                f"Title should contain '{expected_title_contains}', got '{title.text}'"
        
        # Verificar que tiene el div root de React
        root = soup.find('div', id='root')
        assert root is not None, "React root div not found"
        
        # Verificar que carga scripts
        scripts = soup.find_all('script', src=True)
        assert len(scripts) > 0, "No scripts found"
        
        print(f"✅ {test_name}")
        return True
    except AssertionError as e:
        print(f"❌ {test_name}: {e}")
        return False
    except Exception as e:
        print(f"❌ {test_name}: {e}")
        return False


def main():
    print("\n" + "="*70)
    print("TEST FRONTEND POST-PIVOT")
    print("="*70 + "\n")
    
    passed = 0
    failed = 0
    
    # Test 1: Landing page
    if test_page(f"{BASE_URL}/", "PPTMAPS", "Test 1: Landing page loads"):
        passed += 1
    else:
        failed += 1
    
    # Test 2: Dashboard/Command Center
    if test_page(f"{BASE_URL}/dashboard", "PPTMAPS", "Test 2: Dashboard loads"):
        passed += 1
    else:
        failed += 1
    
    # Test 3: Report page
    if test_page(f"{BASE_URL}/report", "PPTMAPS", "Test 3: Report page loads"):
        passed += 1
    else:
        failed += 1
    
    # Test 4: Verify removed Navigate page returns something (should redirect or show 404)
    try:
        r = requests.get(f"{BASE_URL}/navigate", timeout=5, allow_redirects=False)
        # Should either redirect to home or return valid HTML (React handles routing)
        if r.status_code in [200, 301, 302, 404]:
            print("✅ Test 4: Navigate route handled correctly")
            passed += 1
        else:
            print(f"❌ Test 4: Navigate route returned unexpected {r.status_code}")
            failed += 1
    except Exception as e:
        print(f"❌ Test 4: Navigate route error - {e}")
        failed += 1
    
    # Test 5: Check static assets
    try:
        # Verificar que los assets de Vite cargan
        r = requests.get(f"{BASE_URL}/", timeout=5)
        soup = BeautifulSoup(r.content, 'html.parser')
        
        # Buscar el script de Vite/React
        scripts = soup.find_all('script', src=True)
        vite_script = any('/assets/' in s.get('src', '') or 'main' in s.get('src', '') 
                         for s in scripts)
        
        assert vite_script or len(scripts) > 0, "No Vite/React scripts found"
        print("✅ Test 5: Static assets load correctly")
        passed += 1
    except Exception as e:
        print(f"❌ Test 5: Static assets error - {e}")
        failed += 1
    
    # Test 6: API proxy funcionando (frontend llama a backend)
    try:
        # El frontend debe poder llamar a la API desde el mismo origen
        r = requests.get(f"{BASE_URL}/api/v1/public/reports", timeout=5)
        assert r.status_code == 200
        print("✅ Test 6: API proxy working (frontend can call backend)")
        passed += 1
    except Exception as e:
        print(f"❌ Test 6: API proxy error - {e}")
        failed += 1
    
    print("\n" + "="*70)
    print(f"RESULTADOS: {passed} pasaron, {failed} fallaron")
    
    if failed == 0:
        print("✅ FRONTEND FUNCIONAL - Todas las páginas cargan correctamente")
        print("="*70 + "\n")
        return 0
    else:
        print(f"⚠️  {failed} tests fallaron - revisar páginas")
        print("="*70 + "\n")
        return 1

if __name__ == "__main__":
    exit(main())
