from fastapi import FastAPI
from routes import router as optimize_router

app = FastAPI(title="Smart Delivery Route Planner - API", version="0.1.0")

app.include_router(optimize_router, prefix="/api")