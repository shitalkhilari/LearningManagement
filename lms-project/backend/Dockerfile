FROM node:22-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/ .
COPY database /database
EXPOSE 3000
CMD ["sh", "-c", "npm run migration:run && npm run start:dev"]
