# The site is static: Docusaurus builds it, nginx serves it. Forge runs the
# image as a non-root user with a read-only root filesystem, so nginx.conf
# keeps everything nginx writes in /tmp. Images come through Google's mirror
# of Docker Hub, which does not rate-limit CI runners.
FROM mirror.gcr.io/library/node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM mirror.gcr.io/nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/build /usr/share/nginx/html
USER 101:101
EXPOSE 3000
# nginx itself, without the image's entrypoint scripts, which try to edit
# files under /etc.
ENTRYPOINT ["nginx", "-g", "daemon off;"]
