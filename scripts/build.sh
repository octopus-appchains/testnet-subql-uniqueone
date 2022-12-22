#!/bin/bash
yarn install
yarn run codegen
yarn run build
rm -rf .data