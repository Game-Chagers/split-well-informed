# Use node version 24 as base image
FROM node:24

# Go to app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the app into the image
COPY . .

# Set port environment variable
ENV PORT=8081

# Expose port so computer can access it (does nothing, just for documentation)
EXPOSE 8081

# Run the app
CMD ["npm", "start"]