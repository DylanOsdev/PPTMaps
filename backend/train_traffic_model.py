"""Script para entrenar modelo XGBoost de predicción de congestión.

Entrena con 6,489 ejemplos reales de patrones históricos de accidentes.
"""
import asyncio
import sys
from pathlib import Path
import joblib

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
import numpy as np
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBRegressor
from sqlalchemy import text
from app.db.database import async_session_maker


async def train_model():
    """Entrena modelo XGBoost con validación cruzada."""
    
    print("🤖 Entrenando modelo ML de predicción de congestión...")
    
    async with async_session_maker() as db:
        # Cargar dataset con clima histórico REAL
        result = await db.execute(text("""
            SELECT 
                hora, dia_semana, mes, comuna,
                lat_promedio, lng_promedio,
                gravedad_promedio,
                es_hora_pico, es_fin_semana,
                temp_promedio, lluvia_mm_promedio, humedad_promedio,
                total_deprimidos,
                congestion_risk
            FROM traffic_predictions_training
        """))
        
        rows = result.fetchall()
        
    print(f"Dataset cargado: {len(rows):,} ejemplos")
    
    # Convertir a DataFrame con clima histórico REAL
    df = pd.DataFrame(rows, columns=[
        'hora', 'dia_semana', 'mes', 'comuna',
        'lat', 'lng', 'gravedad',
        'es_hora_pico', 'es_fin_semana',
        'temp_promedio', 'lluvia_mm_promedio', 'humedad_promedio',
        'total_deprimidos',
        'target'
    ])
    
    # Convertir tipos
    df['gravedad'] = df['gravedad'].astype(float)
    df['target'] = df['target'].astype(int)
    df['temp_promedio'] = df['temp_promedio'].astype(float)
    df['lluvia_mm_promedio'] = df['lluvia_mm_promedio'].astype(float)
    df['humedad_promedio'] = df['humedad_promedio'].astype(float)
    
    # Codificar comunas
    le_comuna = LabelEncoder()
    df['comuna_encoded'] = le_comuna.fit_transform(df['comuna'])
    
    # Features con clima histórico REAL (temperatura, lluvia, humedad)
    X = df[[
        'hora', 'dia_semana', 'mes', 'comuna_encoded', 
        'lat', 'lng', 'gravedad',
        'es_hora_pico', 'es_fin_semana',
        'temp_promedio', 'lluvia_mm_promedio', 'humedad_promedio',
        'total_deprimidos'
    ]]
    y = df['target']
    
    print(f"✅ Features: {list(X.columns)}")
    print(f"✅ Target: congestion_risk (0-100)")
    
    # Split train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"\n📈 Train: {len(X_train):,} | Test: {len(X_test):,}")
    
    # Entrenar XGBoost
    print("\n⏳ Entrenando XGBoost...")
    model = XGBRegressor(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluar
    train_score = model.score(X_train, y_train)
    test_score = model.score(X_test, y_test)
    
    print(f"\n✅ Modelo entrenado:")
    print(f"   R² Train: {train_score:.3f}")
    print(f"   R² Test:  {test_score:.3f}")
    
    # Cross-validation
    print("\n⏳ Validación cruzada (5-fold)...")
    cv_scores = cross_val_score(model, X, y, cv=5, scoring='r2')
    print(f"✅ CV R² medio: {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\n📊 Feature Importance:")
    for idx, row in feature_importance.iterrows():
        print(f"   {row['feature']:15s}: {row['importance']:.3f}")
    
    # Guardar modelo y encoder
    models_dir = Path(__file__).parent / "app" / "ml" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    model_path = models_dir / "traffic_model.joblib"
    encoder_path = models_dir / "comuna_encoder.joblib"
    
    joblib.dump(model, model_path)
    joblib.dump(le_comuna, encoder_path)
    
    print(f"\n💾 Modelo guardado:")
    print(f"   {model_path}")
    print(f"   {encoder_path}")
    
    # Test de predicción
    print("\n🧪 Test de predicción:")
    test_cases = [
        {'hora': 14, 'dia': 6, 'mes': 6, 'comuna': 'La Candelaria', 'lat': 6.2518, 'lng': -75.5636, 'grav': 2.0},
        {'hora': 8, 'dia': 2, 'mes': 6, 'comuna': 'Poblado', 'lat': 6.2090, 'lng': -75.5726, 'grav': 1.5},
        {'hora': 2, 'dia': 0, 'mes': 6, 'comuna': 'Robledo', 'lat': 6.2800, 'lng': -75.6200, 'grav': 1.0},
    ]
    
    for tc in test_cases:
        try:
            comuna_enc = le_comuna.transform([tc['comuna']])[0]
            X_pred = pd.DataFrame([[
                tc['hora'], tc['dia'], tc['mes'], comuna_enc,
                tc['lat'], tc['lng'], tc['grav']
            ]], columns=X.columns)
            
            pred = model.predict(X_pred)[0]
            dia_str = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][tc['dia']]
            print(f"   {tc['comuna']:15s} {tc['hora']:02d}:00 {dia_str} → Riesgo: {pred:3.0f}/100")
        except ValueError:
            print(f"   {tc['comuna']:15s} (comuna no en training set)")
    
    return {
        'train_score': float(train_score),
        'test_score': float(test_score),
        'cv_mean': float(cv_scores.mean()),
        'cv_std': float(cv_scores.std()),
        'n_examples': len(rows)
    }


if __name__ == "__main__":
    results = asyncio.run(train_model())
    print(f"\n🎯 Modelo listo para producción")
    print(f"   Precisión: {results['test_score']:.1%}")
    print(f"   Ejemplos: {results['n_examples']:,}")
