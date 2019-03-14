#!/usr/bin/env bash

# Recover tests skipped with .tmp prefix
find ./test/integration -name "test*.skip" -exec sh -c 'mv "$1" "${1%.skip}.js"' _ {} \;
