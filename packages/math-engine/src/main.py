from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import math

app = FastAPI(
    title="OpenMath Math Engine",
    version="0.1.0",
    description="SymPy-based math verification service",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(math.router)


@app.get("/health")
def health():
    return {"status": "ok", "engine": "sympy"}
