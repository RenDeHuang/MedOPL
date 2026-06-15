FROM node:22-bookworm-slim

WORKDIR /opt/medopl-platform-runner

COPY tests/support/cloud-prework/package-d-platform-runner-entrypoint.js ./package-d-platform-runner-entrypoint.js

USER node

ENTRYPOINT ["node", "/opt/medopl-platform-runner/package-d-platform-runner-entrypoint.js"]
CMD ["preflight"]
