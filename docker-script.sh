node -r ts-node/register -r tsconfig-paths/register -r dotenv/config ./node_modules/typeorm/cli.js -d ./ormconfig.ts migration:run
dumb-init node ./dist/main.js