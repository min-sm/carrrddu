FROM ghcr.io/puppeteer/puppeteer:22.6.2

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci
COPY . .


# RUN apt-get update && apt-get install -y chromium-browser
# RUN apt-get update && apt-get install -y chromium-browser
# Install required packages
# RUN apt-get update && apt-get install -y dbus
# RUN dbus-uuidgen --ensure=/etc/machine-id

RUN apt-get update && apt-get install -y --no-install-recommends chromium-browser

CMD [ "./node_modules/.bin/nodemon", "server.js" ]