// src/commands/enroll.ts
import { Command } from 'commander';
import { AcornClient } from '../lib/acorn';
import logger from '../lib/logger';
import { CourseEnrollmentConfig } from '../types';

export const enrollCommand = new Command('enroll')
  .description('Enroll in a course')
  .requiredOption('-c, --course <code>', 'Course code (e.g., CSC108H1)')
  .option('-s, --section <code>', 'Section code (F/S/Y)', 'F')
  .option('-w, --wait <seconds>', 'Wait time between checks', '30')
  .option('-t, --tutorial <sections>', 'Tutorial sections (comma separated)')
  .option('-l, --lecture <sections>', 'Lecture sections (comma separated)')
  .option('-m, --monitor', "Monitor mode - don't enroll, just watch", false)
  .action(async (options) => {
    try {
      const client = new AcornClient();
      await client.init();

      // Verify session before proceeding
      const isValid = await client.verifySession();
      if (!isValid) {
        logger.error('Session expired, please login again');
        process.exit(1);
      }

      const config: CourseEnrollmentConfig = {
        courseCode: options.course,
        sessionCode:
          new Date().getFullYear().toString() +
          (new Date().getMonth() >= 8 ? '9' : new Date().getMonth() <= 2 ? '1' : '5'),
        sectionCode: options.section,
        tutorialSections: options.tutorial?.split(','),
        lectureSections: options.lecture?.split(','),
        waitTime: parseInt(options.wait),
      };

      logger.info(
        `Starting ${options.monitor ? 'monitoring' : 'enrollment process'} for ${config.courseCode}`
      );

      // Add signal handlers for graceful shutdown
      let running = true;
      process.on('SIGINT', () => {
        logger.info('Received stop signal, shutting down...');
        running = false;
      });

      process.on('SIGTERM', () => {
        logger.info('Received termination signal, shutting down...');
        running = false;
      });

      // Main monitoring loop
      while (running) {
        try {
          await client.checkCourseAvailability(config, options.monitor);
          if (options.monitor) {
            await new Promise((resolve) => setTimeout(resolve, config.waitTime * 1000));
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('Session expired')) {
            logger.error('Session expired, please login again');
            process.exit(1);
          }
          logger.error('Error during check:', error);
          // Continue the loop after error unless we're stopping
          if (running) {
            await new Promise((resolve) => setTimeout(resolve, config.waitTime * 1000));
          }
        }
      }

      // Clean up
      await client.close();
      process.exit(0);
    } catch (error) {
      logger.error('Process failed:', error);
      process.exit(1);
    }
  });
