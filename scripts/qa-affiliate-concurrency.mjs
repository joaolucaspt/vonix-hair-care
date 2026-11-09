/**
 * LOCAL QA ONLY. Against docker --network none and a disposable PostgreSQL database.
 * Never execute against the production Vonix Hair/Supabase instance.
 */
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
const exec = promisify(execFile);
const container = process.env["VONIX_QA_CONTAINER"] || "vonix-affiliates-sql-qa";
const database = process.env["VONIX_QA_DATABASE"] || "vonix_affiliates_qa";

// Refuse all other containers or non-disposable DB names. Never use production.
if (!["vonix-affiliates-sql-qa", "vonix-governance-sqlqa"].includes(container) ||
    !["vonix_affiliates_qa", "affiliate_qa"].includes(database)) {
  throw new Error("QA target must be an approved disposable database");
}
const { stdout: networkMode } = await exec("docker", [
  "inspect", "--format", "{{.HostConfig.NetworkMode}}", container,
], { timeout: 10000 });
if (networkMode.trim() !== "none") {
  throw new Error("Refusing QA: container must be isolated with --network none");
}

async function sql(statement) {
  const { stdout } = await exec(
    "docker",
    [
      "exec",
      container,
      "psql",
      "-X",
      "-q",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      database,
      "-c",
      statement,
    ],
    { timeout: 10000 },
  );
  return stdout.trim();
}

try {
  const name = "qa" + randomUUID().replaceAll("-", "").slice(0, 14);
  const email = name + "@example.invalid";
  const statement = `SET ROLE service_role;
  INSERT INTO public.vonix_affiliate_applications
    (full_name, age, city, state, hair_type, email, instagram_url, tiktok_url,
     motivation, consent_at)
  VALUES
    ('QA Corrida Concorrente', 26, 'Belo Horizonte', 'MG', 'Cacheado',
     '${email}', 'https://instagram.com/${name}', 'https://tiktok.com/@${name}',
     'Candidatura sintética, usada apenas para testar concorrência em banco isolado.', now())
  RETURNING id;`;
  const output = await sql(statement);
  const id = output
    .split(/\r?\n/)
    .find((x) => /^[0-9a-f-]{36}$/i.test(x))
    ?.trim();
  if (!id) throw new Error("Could not create synthetic record: " + output);

  const transition = (decision) =>
    sql(`SET ROLE service_role;
      SELECT public.vonix_affiliate_decide('${id}'::uuid, '${decision}');`);
  const [one, two] = await Promise.all([transition("aprovada"), transition("recusada")]);
  const outcomes = [one, two].map((x) => x.split(/\r?\n/).at(-1));
  if (
    outcomes.filter((x) => x === "t").length !== 1 ||
    outcomes.filter((x) => x === "f").length !== 1
  ) {
    throw new Error("Concurrent decisions were not exclusive: " + JSON.stringify(outcomes));
  }
  const rows = await sql(`SET ROLE service_role;
    SELECT count(*) FROM public.vonix_affiliate_mail_outbox
     WHERE application_id = '${id}'::uuid;`);
  if (rows.split(/\r?\n/).at(-1) !== "1") {
    throw new Error("Expected exactly one outbox entry: " + rows);
  }
  process.stdout.write(
    "QA PASS: two concurrent review requests -> one committed decision, one rejected, one outbox email.\n",
  );
} catch (error) {
  process.stderr.write(
    "QA FAIL: " + (error instanceof Error ? error.message : String(error)) + "\n",
  );
  process.exitCode = 1;
}
