// @ts-ignore
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  user: 'postgres',
  password: '2006',
  host: 'localhost',
  port: 5432,
  database: 'postgres'
});

async function createDb() {
  await client.connect();
  try {
    await client.query('CREATE DATABASE indhumathi');
    console.log("Database created successfully");
  } catch (e: any) {
    if (e.code === '42P04') {
      console.log("Database already exists");
    } else {
      console.error("Failed to create database: " + e.message);
      process.exit(1);
    }
  }
  await client.end();
}

createDb();
