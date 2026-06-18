#!/bin/bash
# Start both backend and frontend dev servers

export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

echo "🏥 Starting Senior Daily Check-In App..."
echo ""

# Start backend
(cd "$(dirname "$0")/backend" && node src/index.js) &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID) → http://localhost:3001"

sleep 1

# Start frontend
(cd "$(dirname "$0")/frontend" && npm run dev) &
FRONTEND_PID=$!
echo "✅ Frontend started → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

# Kill both on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Servers stopped.'" EXIT
wait
