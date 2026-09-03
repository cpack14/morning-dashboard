import pkg from "@flow-js/garmin-connect";
const { GarminConnect } = pkg;
import { writeFileSync } from "node:fs";

const username = process.env.GARMIN_USERNAME;
const password = process.env.GARMIN_PASSWORD;

if (!username || !password) {
  console.error("Set GARMIN_USERNAME and GARMIN_PASSWORD env vars before running.");
  process.exit(1);
}

const client = new GarminConnect({ username, password });
await client.login();

const oauth1 = client.client.oauth1Token;
const oauth2 = client.client.oauth2Token;

writeFileSync(
  "garmin-tokens.json",
  JSON.stringify({ oauth1, oauth2 }, null, 2),
);

console.log("Login succeeded. Tokens written to garmin-tokens.json");
