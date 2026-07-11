# Stage 1: Build the Vite production bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency configs
COPY package*.json ./

# Install dependencies including devDependencies for build steps
RUN npm ci

# Copy codebase
COPY . .

# Compile application
RUN npm run build

# Stage 2: Serve statically compiled files using Nginx
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose web service port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
