#!/bin/bash
# ============================================================
# ScaleMind AI — Başlangıç Scripti
# Her iki servisi otomatik başlatır
# Kullanım: ./start.sh
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "🚀 ScaleMind AI başlatılıyor..."
echo "📁 Proje dizini: $PROJECT_DIR"

# Backend başlat
echo ""
echo "▶ Backend başlatılıyor (port 8000)..."
osascript -e "tell application \"Terminal\"
  activate
  do script \"cd '$BACKEND_DIR' && uvicorn api.main:app --port 8000 --host 0.0.0.0 && exec zsh\"
end tell"

# 3 saniye bekle
sleep 3

# Frontend başlat
echo "▶ Frontend başlatılıyor (port 5173)..."
osascript -e "tell application \"Terminal\"
  activate
  do script \"cd '$FRONTEND_DIR' && npm run dev && exec zsh\"
end tell"

# 4 saniye bekle
sleep 4

# Tarayıcıda aç
echo "🌐 Tarayıcı açılıyor..."
open http://localhost:5173

echo ""
echo "✅ ScaleMind AI çalışıyor!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo ""
echo "Durdurmak için her iki terminal penceresinde Ctrl+C kullanın."
