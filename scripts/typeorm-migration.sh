#!/bin/bash

if [ $# -lt 2 ]; then
  echo "Please specify a name for the migration"
else
  npm run typeorm -- $1 ./migrations/$2
fi