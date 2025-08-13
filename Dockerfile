FROM node:18-alpine

WORKDIR /app

# Install Python, Chromium and dependencies for Selenium scraping
RUN apk add --no-cache \
    python3 \
    py3-pip \
    chromium \
    chromium-chromedriver \
    bash \
    && rm -rf /var/cache/apk/*

# Set Chrome binary location for Selenium
ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROMEDRIVER_PATH=/usr/bin/chromedriver

# Copy package files
COPY package.json ./
RUN npm install

# Copy all source code
COPY . .

# Install Python dependencies
RUN pip3 install -r requirements.txt --break-system-packages || true

# Build frontend
RUN npm run build || true

EXPOSE 3001

CMD ["node", "server/index.js"]