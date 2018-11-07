#!/usr/bin/env bash

# Recover tests skipped with .tmp prefix
find ./test/integration -name "test*.skip" -exec sh -c 'mv "$1" "${1%.skip}.js"' _ {} \;
mv ./migrations/2_deploy_contracts.js ./migrations/2_deploy_contracts.mock
mv ./migrations/2_deploy_contracts.skip ./migrations/2_deploy_contracts.js
mv ./migrations/3_add_users.skip ./migrations/3_add_users.js