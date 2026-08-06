import { createInterface } from "node:readline";

// Interactive prompt helpers for credential entry (used by `agentbrain login`).
// Kept separate from the callers so both text and secret prompts share the same
// TTY handling and are trivially reusable.

// Prompt for a plain line of input. Trims trailing newline.
export function promptText(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
    rl.on("error", reject);
  });
}

// Prompt for a secret WITHOUT echoing keystrokes to the terminal. The prompt
// text itself is printed once; typed characters are suppressed so passwords
// never appear on screen or in scrollback.
//
// When stdin is not a TTY (piped input, CI), muting is not possible/meaningful,
// so we fall back to a normal line read.
export function promptSecret(query: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return promptText(query);
  }

  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    // Print the prompt ourselves, then swallow all subsequent echo writes so
    // the entered characters are not shown. readline's internal writer is not
    // in the public types, hence the narrow cast.
    process.stdout.write(query);
    const rlWithWriter = rl as unknown as { _writeToOutput?: (s: string) => void };
    rlWithWriter._writeToOutput = () => {};

    rl.question("", (answer) => {
      // Restore normal echoing before closing, and move to a fresh line since
      // the user's Enter keystroke was suppressed.
      rlWithWriter._writeToOutput = (s: string) => process.stdout.write(s);
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    rl.on("error", reject);
  });
}
