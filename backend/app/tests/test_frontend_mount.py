from app.main import resolve_frontend_dir


def test_returns_dist_when_build_exists(tmp_path):
    dist = tmp_path / "frontend" / "dist"
    dist.mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html>")
    assert resolve_frontend_dir(tmp_path) == dist


def test_returns_none_without_build(tmp_path):
    # frontend/ existe pero sin dist compilado (solo el index.html de desarrollo)
    (tmp_path / "frontend").mkdir()
    assert resolve_frontend_dir(tmp_path) is None
