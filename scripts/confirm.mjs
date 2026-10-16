import { createInterface } from "node:readline";

/*
 * Asks the operator to type `word`. Where the terminal gives the script no
 * keyboard input (npm on some Windows set-ups), the operator can pass
 * --confirm=<word> on the command line instead, after reading the output.
 * Resolves to "confirmed", "declined" or "no-input".
 */
export async function confirm(question, word) {
  const given = process.argv.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length);
  if (given !== undefined) {
    console.log(`\n${question}\n→ ${given === word ? `confirmed by --confirm=${word}` : `--confirm=${given} is not ${word}`}`);
    return given === word ? "confirmed" : "declined";
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    prompt.on("close", () => resolve(null));
    prompt.question(`\n${question} Type ${word} to continue: `, resolve);
  });
  prompt.close();
  if (answer === null) return "no-input";
  return answer.trim() === word ? "confirmed" : "declined";
}
