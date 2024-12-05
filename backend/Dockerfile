# Use Node.js base image
FROM node:23-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Expose port 3001
EXPOSE 3001

# Start the server
CMD ["npm", "start"]