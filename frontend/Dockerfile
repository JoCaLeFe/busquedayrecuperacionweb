# Use Node.js base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build the app
RUN npm run build

# Install serve to run the built app
RUN npm install -g serve

# Expose port 3000
EXPOSE 3000

# Start serving the built app
CMD ["serve", "-s", "dist", "-p", "3000"]