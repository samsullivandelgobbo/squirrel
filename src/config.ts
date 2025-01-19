// src/config.ts
import fs from "fs/promises";
import path from "path";
import { AcornConfig, StoredCookie } from "./types";
import logger from "./lib/logger";

export class ConfigManager {
  private configPath: string;
  private config: AcornConfig;

  constructor() {
    this.configPath = path.join(
      process.env.APPDATA || process.env.HOME || "",
      ".squirrel",
      "config.json"
    );
    this.config = {
      utorid: "",
      password: "",
      bypassCodes: [],
    };
  }

  async load(): Promise<AcornConfig> {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      this.config = JSON.parse(data);
    } catch (error) {
      logger.debug("No existing config found, using defaults");
    }
    return this.config;
  }

  async save(): Promise<void> {
    const configDir = path.dirname(this.configPath);
    try {
      await fs.mkdir(configDir, { recursive: true });

      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      logger.debug(`Config saved to ${this.configPath}`);
    } catch (error) {
      logger.error("Failed to save config:", error);
      throw error;
    }
  }

  async updateSession(cookies: StoredCookie[]): Promise<void> {
    this.config.cookies = cookies;
    this.config.lastLogin = new Date().toISOString();
    await this.save();
    logger.debug(`Session updated with ${cookies.length} cookies`);
  }

  async clearSession(): Promise<void> {
    this.config.cookies = undefined;
    this.config.lastLogin = undefined;
    await this.save();
    logger.debug("Session cleared");
  }
}
