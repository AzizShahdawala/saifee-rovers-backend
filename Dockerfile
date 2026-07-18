FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    AI_SERVICE_URL=http://127.0.0.1:8000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY ai/requirements.txt ./ai/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r ai/requirements.txt

COPY . .

EXPOSE 10000
CMD ["node", "scripts/startProduction.js"]
