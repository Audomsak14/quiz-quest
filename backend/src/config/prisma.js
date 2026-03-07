require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';

const adapter = new PrismaBetterSqlite3({
	url: DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
