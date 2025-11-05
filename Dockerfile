# Stage 1: Build React frontend
FROM node:16-alpine as build-react
WORKDIR /app/frontend

COPY 3d-print-calculator/frontend/package.json ./
COPY 3d-print-calculator/frontend/package-lock.json ./
RUN npm install

COPY 3d-print-calculator/frontend/ ./
RUN npm run build

# Stage 2: Create Flask application
FROM python:3.9-slim
WORKDIR /app

# Create a non-root user
RUN addgroup --system app && adduser --system --group app

# Install dependencies
COPY 3d-print-calculator/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY 3d-print-calculator/backend/ ./backend/

# Copy built React app
COPY --from=build-react /app/frontend/build ./backend/static

RUN mkdir /data && chown app:app /data
COPY 3d-print-calculator/backend/init_db.py ./backend/
RUN python backend/init_db.py

# Switch to non-root user
USER app

EXPOSE 5000
CMD ["python", "backend/app.py"]
