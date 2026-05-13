const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString });
  await client.connect();
  const result = await client.query(
    "select now() as now, current_database() as db, current_user as usr",
  );
  console.log(result.rows[0]);
  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
