FROM ghcr.io/puppeteer/puppeteer:22.6.2

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \ 
    PORT=3000

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci
COPY . .
CMD [ "./node_modules/.bin/nodemon", "server.js" ]