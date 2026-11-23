FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=America/Lima

WORKDIR /app

COPY ml/requirements.txt ./ml/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ml/requirements.txt

COPY ml/losa_ml ./ml/losa_ml
COPY ml/predict_ocupacion.py ./ml/predict_ocupacion.py
COPY ml/cron_diario.py ./ml/cron_diario.py

RUN useradd --create-home app && chown -R app:app /app
USER app

CMD ["python", "-m", "ml.cron_diario"]
