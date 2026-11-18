#!/usr/bin/env node
/**
 * Runs a command inside the Firebase emulators (project demo-dourya):
 *
 *   node scripts/emulators.mjs [--ui] "<command>"
 *
 * Windows: the Firestore emulator (Java) opens an internal AF_UNIX socket in the
 * temp folder; when that path is too long it stops with "Unable to establish
 * loopback connection". The socket folder is moved to a short path in the project.
 * Requires firebase-tools (npm i -g firebase-tools) and Java 21+.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const ui = args.includes("--ui");
const command = args.filter((a) => a !== "--ui").join(" ");
if (!command) {
  console.error('Usage: node scripts/emulators.mjs [--ui] "<command>"');
  process.exit(1);
}

const env = { ...process.env };
// On the emulators, DOURYA e-mails go to the in-memory test outbox: nothing is ever sent.
env.EMAIL_TRANSPORT ??= "test";
if (process.platform === "win32" && !env.JAVA_TOOL_OPTIONS?.includes("jdk.net.unixdomain.tmpdir")) {
  const dir = join(process.cwd(), ".emulators-tmp");
  mkdirSync(dir, { recursive: true });
  env.JAVA_TOOL_OPTIONS = `${env.JAVA_TOOL_OPTIONS ?? ""} -Djdk.net.unixdomain.tmpdir=${dir}`.trim();
}

const firebaseArgs = ["emulators:exec", "--project", "demo-dourya", "--only", "auth,firestore,storage", ...(ui ? ["--ui"] : []), JSON.stringify(command)];
const child = spawn("firebase", firebaseArgs, { stdio: "inherit", env, shell: true });
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
