FROM node:22-alpine AS builder
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Replace symlinks with real files for the build
RUN rm -f public/results.json public/matchups.json public/team_meta.json public/golden_boot.json public/squads.json public/report.pdf
RUN rm -rf public/eda && mkdir -p public/eda
COPY output/results.json ./public/results.json
COPY output/matchups.json ./public/matchups.json
COPY output/team_meta.json ./public/team_meta.json
COPY output/golden_boot.json ./public/golden_boot.json
COPY output/squads.json ./public/squads.json
COPY output/eda/ ./public/eda/
COPY output/report.pdf ./public/report.pdf
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
