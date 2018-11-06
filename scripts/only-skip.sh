#!/usr/bin/env bash

# Add .tmp prefix to integration test files to speedup test runs selected with `.only` mocha modifier
find ./test/integration -name "test*.js" -exec sh -c 'grep -rhF ".only" "$1" || mv "$1" "${1%.js}.skip"' _ {} \;
mv ./migrations/2_deploy_contracts.js ./migrations/2_deploy_contracts.skip
mv ./migrations/2_deploy_contracts.mock ./migrations/2_deploy_contracts.js
mv ./migrations/3_add_users.js ./migrations/3_add_users.skip