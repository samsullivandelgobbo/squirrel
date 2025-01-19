import { Command } from "commander";
import inquirer from "inquirer";
import { AcornClient } from "../lib/acorn";
import logger from "../lib/logger";

export const loginCommand = new Command("login")
  .description("Login to Acorn")
  .action(async () => {
    let utorid = process.env.UTORID;
    let password = process.env.PASSWORD;

    if (utorid && password) {
      logger.info("Using UTORid and password from environment variables");
    } else {
      logger.info("No UTORid or password provided, prompting user");
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "utorid",
          message: "Enter your UTORid:",
        },
        {
          type: "password",
          name: "password",
          message: "Enter your password:",
        },
      ]);
      utorid = answers.utorid;
      password = answers.password;
    }
    if (!utorid || !password) {
      logger.error("Missing UTORid or password");
      process.exit(1);
    }

    try {
      const client = new AcornClient();
      await client.init();
      await client.login(utorid, password);
      logger.info("Successfully logged in and saved session");
      await client.close();
    } catch (error) {
      logger.error("Login failed:", error);
      process.exit(1);
    }
  });
