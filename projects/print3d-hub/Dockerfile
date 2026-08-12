FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js, xvfb, and Bambu Studio dependencies
RUN apt-get update && apt-get install -y \
    curl \
    xvfb \
    libwebkit2gtk-4.1-0 \
    libgtk-3-0 \
    libgstreamer1.0-0 \
    libgl1 \
    libglib2.0-0 \
    libdbus-1-3 \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Download and extract Bambu Studio AppImage
WORKDIR /opt/bambustudio_setup
RUN curl -L -o BambuStudio.AppImage "https://github.com/bambulab/BambuStudio/releases/download/v02.07.01.62/BambuStudio_ubuntu24.04-v02.07.01.62-20260616195227.AppImage" \
    && chmod +x BambuStudio.AppImage \
    && ./BambuStudio.AppImage --appimage-extract \
    && mv squashfs-root /opt/bambustudio \
    && rm -rf /opt/bambustudio_setup

# Setup Node.js app
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose the port
EXPOSE 5001

# Start the application
CMD ["npm", "start"]
