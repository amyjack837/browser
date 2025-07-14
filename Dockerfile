# Use the official Node.js image as a base image
FROM node:18-slim

# Install dependencies for Puppeteer and any other required system libraries
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    apt-transport-https \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Puppeteer and other required Node.js dependencies
WORKDIR /app
COPY package.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the necessary port
EXPOSE 3000

# Start the bot
CMD ["node", "index.js"]
