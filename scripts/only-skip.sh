#!/usr/bin/env bash

# Add .tmp prefix to integration test files to speedup test runs selected with `.only` mocha modifier
find ./test/integration -name "test*.js" -exec sh -c 'grep -rhF ".only" "$1" || mv "$1" "${1%.js}.skip"' _ {} \;
