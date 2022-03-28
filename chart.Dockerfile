FROM node:14.4.0 as builder

MAINTAINER Thien Nguyen Thanh <thienn@actable.ai>

ENV HOST=0.0.0.0

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY services/charts/package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY services/charts/ .

RUN  npm run build


CMD ["npm", "run", "start"]
