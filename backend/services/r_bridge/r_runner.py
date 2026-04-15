# ============================================================
# ScaleMind AI — R Runner (Python → R Köprüsü)
# R scriptlerini subprocess ile çalıştırır.
# ============================================================

import subprocess
import json
import os
from pathlib import Path

R_SCRIPTS_DIR = Path(__file__).parent.parent.parent / "r_scripts"
R_EXECUTABLE  = os.getenv("R_EXECUTABLE", "Rscript")

def run_r_script(script_name: str, input_data: dict) -> dict:
    """
    Belirtilen R scriptini çalıştırır.
    Input JSON çevre değişkeni SCALEMIND_INPUT üzerinden aktarılır.
    Stdout'tan JSON sonucu alır.
    """
    script_path = R_SCRIPTS_DIR / script_name
    if not script_path.exists():
        raise FileNotFoundError(f"R scripti bulunamadı: {script_path}")

    import math
    def clean_nan(obj):
        if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
            return None
        if isinstance(obj, dict):
            return {k: clean_nan(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [clean_nan(v) for v in obj]
        return obj
    input_json = json.dumps(clean_nan(input_data), ensure_ascii=False)

    env = {**os.environ, "SCALEMIND_INPUT": input_json}

    proc = subprocess.run(
        [R_EXECUTABLE, "--vanilla", "--quiet", str(script_path)],
        capture_output=True,
        text=True,
        env=env,
        timeout=120,  # 2 dakika timeout
    )

    if proc.returncode != 0:
        stderr = proc.stderr.strip()
        raise RuntimeError(f"R scripti başarısız ({script_name}): {stderr}")

    stdout = proc.stdout.strip()
    if not stdout:
        raise RuntimeError(f"R scripti çıktı üretmedi: {script_name}")

    try:
        result = json.loads(stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"R JSON ayrıştırma hatası: {e}\nR stdout: {stdout[:500]}")

    if not result.get("success", True):
        err = result.get("error", "Bilinmeyen R hatası")
        raise RuntimeError(f"R analizi başarısız: {err}")

    # NaN ve Inf değerlerini None'a çevir
    import math
    def sanitize(obj):
        if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
            return None
        if isinstance(obj, dict):
            return {k: sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [sanitize(v) for v in obj]
        return obj

    return sanitize(result)
