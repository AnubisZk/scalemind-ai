# ============================================================
# ScaleMind AI Backend — Python + R
# Railway veya Fly.io için
# ============================================================

FROM python:3.12-slim

# Sistem bağımlılıkları + R
RUN apt-get update && apt-get install -y \
    r-base \
    r-base-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libfontconfig1-dev \
    && rm -rf /var/lib/apt/lists/*

# R paketleri kur
RUN Rscript -e "install.packages(c('psych','lavaan','semTools','GPArotation','nFactors','jsonlite'), repos='https://cran.r-project.org')"

# Python bağımlılıkları
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodunu kopyala
COPY . .

# Çalıştır
EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
