#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand, enrollCommand } from "./commands";
import logger from "./lib/logger";
import "dotenv/config";

const program = new Command();

program
  .name("squirrel")
  .description("CLI tool for UofT Acorn course enrollment")
  .version("1.0.0");

program.addCommand(loginCommand);
program.addCommand(enrollCommand);

process.on("SIGINT", () => {
  logger.info("Shutting down...");
  process.exit(0);
});

program.parse();
