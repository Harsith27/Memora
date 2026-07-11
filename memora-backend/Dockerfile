FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Expose backend service port
EXPOSE 3001

# Run the server
CMD ["node", "server.js"]
