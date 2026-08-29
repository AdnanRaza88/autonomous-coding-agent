FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY tsconfig.base.json ./
COPY shared ./shared
COPY packages ./packages
RUN npm install --omit=dev=false

FROM deps AS web
WORKDIR /app/packages/web
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl git \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system agent \
  && useradd --system --gid agent --home /data --shell /usr/sbin/nologin agent \
  && mkdir -p /data /app/web \
  && chown -R agent:agent /data
COPY --from=deps /app /app
COPY --from=web /app/packages/web/dist /app/web
COPY packages/deploy/entrypoint.sh /usr/local/bin/agent-core-entrypoint
RUN chmod +x /usr/local/bin/agent-core-entrypoint \
  && chown -R agent:agent /app
ENV NODE_ENV=production
ENV AGENT_CORE_DATA=/data
ENV AGENT_CORE_WEB_ROOT=/app/web
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
VOLUME ["/data"]
USER agent
ENTRYPOINT ["/usr/local/bin/agent-core-entrypoint"]
