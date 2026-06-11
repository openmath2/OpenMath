import os

import uvicorn


def _env_flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() not in {"0", "false", "no", "off"}


if __name__ == "__main__":
    workers = int(os.getenv("WORKERS", "2"))
    reload_enabled = _env_flag("RELOAD", True) and workers <= 1

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=16180,
        reload=reload_enabled,
        workers=1 if reload_enabled else workers,
    )
