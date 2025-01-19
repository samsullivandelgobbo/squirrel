// src/acorn.ts
import { chromium, Page, Browser, BrowserContext } from 'playwright';
import { AcornConfig, CourseEnrollmentConfig, StoredCookie } from '../types';
import { ConfigManager } from '../config';
import logger from './logger';

export class AcornClient {
  private config: ConfigManager;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  private readonly BYPASS_URL = 'https://bypass.utormfa.utoronto.ca/';
  private readonly ACORN_URL = 'https://acorn.utoronto.ca/sws/#/';
  private readonly COURSE_URL = 'https://acorn.utoronto.ca/sws/rest/enrolment/course/view';

  constructor() {
    this.config = new ConfigManager();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === retries - 1) throw error;

        const isServerError =
          error instanceof Error && error.message.includes('Internal Server Error');

        if (isServerError) {
          logger.warn(`Attempt ${i + 1} failed, retrying in ${this.RETRY_DELAY / 1000}s...`);
          await this.delay(this.RETRY_DELAY);
          continue;
        }

        throw error;
      }
    }
    throw new Error('Maximum retries exceeded');
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false, // Set to true in production
      channel: 'chrome',
    });

    this.context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Load existing cookies if available
    const config = await this.config.load();
    if (config.cookies?.length) {
      await this.context.addCookies(
        config.cookies.map((cookie) => ({
          ...cookie,
          expires: cookie.expires || -1,
        }))
      );
      logger.debug('Restored previous session cookies');
    }

    this.page = await this.context.newPage();
  }

  async saveSession(): Promise<void> {
    if (!this.context) throw new Error('Browser context not initialized');

    const cookies = await this.context.cookies();
    const storedCookies: StoredCookie[] = cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None',
    }));

    await this.config.updateSession(storedCookies);
  }

  async login(utorid: string, password: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      await this.page.goto(this.ACORN_URL);

      // Handle login form
      await this.page.fill('#username', utorid);
      await this.page.fill('#password', password);
      await this.page.click('[name="_eventId_proceed"]');

      // Wait for Duo Security
      await this.page.waitForSelector('#auth-view-wrapper', { timeout: 10000 });

      const config = await this.config.load();
      if (config.bypassCodes?.length > 0) {
        await this.handleBypassCode(config.bypassCodes[0]);
      } else {
        await this.handleDuoAuth();
      }

      // Wait for successful navigation
      await this.page.waitForURL(this.ACORN_URL, { timeout: 60000 });

      // Save all cookies
      await this.saveSession();

      logger.info('Login successful, session saved');
    } catch (error) {
      logger.error('Login failed:', error);
      await this.config.clearSession();
      throw error;
    }
  }

  async verifySession(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      await this.page.goto(this.ACORN_URL);

      // Check if we're still on the login page
      const loginForm = await this.page.$('#username');
      if (loginForm) {
        logger.debug('Session expired, needs re-login');
        return false;
      }

      // Wait for the main Acorn page to load
      await this.page.waitForURL(this.ACORN_URL, { timeout: 5000 });
      return true;
    } catch (error) {
      logger.debug('Session verification failed:', error);
      return false;
    }
  }

  private async handleBypassCode(code: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    await this.page.click('.button--link');
    await this.page.click('[data-testid="test-id-bypass"]');
    await this.page.fill('[name="passcode-input"]', code);
    await this.page.click('[data-testid="verify-button"]');
  }

  private async handleDuoAuth(): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    // handle trust browser button

    ///<button id="trust-browser-button" class="button--primary--full-width button--primary button--xlarge size-margin-top-xlarge size-margin-bottom-medium">Yes, this is my device</button>

    await this.page.click('#trust-browser-button');

    console.log('Waiting for Duo mobile authentication...');
    await this.page.waitForURL(this.ACORN_URL);
  }

  private async getHeaders(): Promise<Record<string, string>> {
    if (!this.page) throw new Error('Browser not initialized');

    const cookies = (await this.context?.cookies()) || [];
    const xsrfToken = cookies.find((c) => c.name === 'XSRF-TOKEN')?.value;

    return {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-CA,en;q=0.9',
      'content-type': 'application/json',
      'x-xsrf-token': xsrfToken || '',
      referer: 'https://acorn.utoronto.ca/sws/',
    };
  }

  async checkCourseAvailability(
    config: CourseEnrollmentConfig,
    monitorOnly: boolean = false
  ): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      // Verify session is still valid
      const isValid = await this.verifySession();
      if (!isValid) {
        throw new Error('Session expired, please login again');
      }

      // Navigate to courses page
      await this.retryOperation(async () => {
        await this.page!.goto('https://acorn.utoronto.ca/sws/#/courses/0');
        await this.page!.waitForLoadState('networkidle');
      });

      // Construct course API URL
      const params = new URLSearchParams({
        courseCode: config.courseCode,
        courseSessionCode: config.sessionCode,
        postCode: 'ASCRSHBSC',
        sectionCode: config.sectionCode,
        sessionCode: config.sessionCode,
      });

      const courseUrl = `https://acorn.utoronto.ca/sws/rest/enrolment/course/view?${params.toString()}`;

      // Make API request with retry logic
      const response = await this.retryOperation(async () => {
        const headers = await this.getHeaders();
        return this.page!.request.get(courseUrl, { headers });
      });

      if (!response.ok()) {
        throw new Error(`Failed to fetch course data: ${response.statusText()}`);
      }

      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch (error) {
        if (responseText.includes('hCaptcha')) {
          logger.error('Captcha detected, please log in again');
          process.exit(1);
        }
        throw error;
      }

      if (data.messages?.errors?.length > 0) {
        throw new Error(`API Error: ${data.messages.errors.join(', ')}`);
      }

      const meetings = data.responseObject?.meetings;
      if (!meetings) {
        throw new Error('No course meeting data found');
      }

      logger.info(`Checking availability for ${config.courseCode}`);

      logger.info(`Checking availability for ${config.courseCode}`);

      for (const meeting of meetings) {
        const { teachMethod, enrollmentSpaceAvailable, totalSpace, sectionNo, displayName } =
          meeting;

        // Skip if this is a tutorial section and we're not specifically looking for tutorials
        if (teachMethod === 'TUT' && !config.tutorialSections?.length) {
          continue;
        }

        const isTargetLecture =
          teachMethod === 'LEC' &&
          (!config.lectureSections?.length || config.lectureSections.includes(sectionNo));

        const isTargetTutorial =
          teachMethod === 'TUT' &&
          (!config.tutorialSections?.length || config.tutorialSections.includes(sectionNo));

        if (isTargetLecture || isTargetTutorial) {
          if (enrollmentSpaceAvailable > 0) {
            const spaceMsg = `${config.courseCode} has ${enrollmentSpaceAvailable} spaces left (total: ${totalSpace}) for ${displayName}`;
            if (monitorOnly) {
              logger.info(`[MONITOR] ${spaceMsg}`);
            } else {
              logger.info(`[ENROLL] ${spaceMsg}`);
              try {
                await this.enrollCourse(config, sectionNo, teachMethod);
                return; // Exit after successful enrollment
              } catch (error) {
                // Log error but continue checking other sections
                logger.error('Enrollment attempt failed:', error);
              }
            }
          } else {
            logger.debug(`${config.courseCode} has no space left for ${displayName}`);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Session expired')) {
        logger.error('Session expired, please login again');
        process.exit(1);
      }
      throw error;
    }
  }

  private async enrollCourse(
    config: CourseEnrollmentConfig,
    sectionNo: string,
    teachMethod: string
  ): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      // First navigate to the course page to get proper context
      const index = new Date().getMonth() >= 3 && new Date().getMonth() < 9 ? 1 : 0;
      const courseSessionUrl = `https://acorn.utoronto.ca/sws/#/courses/${index}`;

      await this.page.goto(courseSessionUrl);
      await this.page.waitForLoadState('networkidle');

      logger.debug('Searching for course on enrollment page...');

      // Search for the course
      const searchInput = await this.page.waitForSelector('#typeaheadInput');
      await searchInput?.fill(config.courseCode);
      await this.delay(2000); // Wait for typeahead

      // Click the course span
      const courseSpanSelector = `span:text-matches("${config.courseCode} ${config.sectionCode}")`;
      await this.page.click(courseSpanSelector);
      await this.delay(2000);

      // Choose section
      const sectionSelector = `#course${teachMethod}${sectionNo}`;
      await this.page.click(sectionSelector);
      await this.delay(1000);

      // Click enroll button
      const buttonId = teachMethod === 'TUT' ? 'modify' : 'enrol';
      const enrollButton = await this.page.waitForSelector(`#${buttonId}`);
      await enrollButton?.click();

      // Wait to see if enrollment was successful
      try {
        await this.page.waitForSelector(`#${config.courseCode}-courseBox`, { timeout: 5000 });
        logger.info(
          `Enrollment SUCCESS! -- now enrolled in ${config.courseCode}@${config.sectionCode}`
        );
        process.exit(0);
      } catch (error) {
        throw new Error('Enrollment failed - course box not found after attempt');
      }
    } catch (error) {
      logger.error('Failed to enroll:', error);
      throw error;
    }
  }

  // private async enrollCourse(
  //   config: CourseEnrollmentConfig,
  //   sectionNo: string,
  //   teachMethod: string
  // ): Promise<void> {
  //   if (!this.page) throw new Error('Browser not initialized');

  //   try {
  //     // First, let's get the enrollment page and ensure we're in the right context
  //     await this.page.goto('https://acorn.utoronto.ca/sws/#/courses/0');
  //     await this.page.waitForLoadState('networkidle');

  //     const enrollUrl = 'https://acorn.utoronto.ca/sws/rest/enrolment/course/modify';
  //     const headers = await this.getHeaders();

  //     // Build the enrollment payload exactly as Acorn expects
  //     const body = {
  //       activeCourse: {
  //         course: {
  //           code: config.courseCode,
  //           sessionCode: config.sessionCode,
  //           sectionCode: config.sectionCode,
  //           primaryTeachMethod: 'LEC',
  //           enroled: false,
  //         },
  //         lecture:
  //           teachMethod === 'LEC'
  //             ? {
  //                 sectionNo: sectionNo, // Remove the "LEC," prefix
  //               }
  //             : {},
  //         tutorial:
  //           teachMethod === 'TUT'
  //             ? {
  //                 sectionNo: sectionNo, // Remove the "TUT," prefix
  //               }
  //             : {},
  //         practical: {},
  //       },
  //       eligRegParams: {
  //         postCode: 'ASCRSHBSC',
  //         postDescription: "A&S Bachelor's Degree Program",
  //         sessionCode: config.sessionCode,
  //         sessionDescription: '',
  //         status: 'REG',
  //         assocOrgCode: '',
  //         acpDuration: '2',
  //         levelOfInstruction: 'U',
  //         typeOfProgram: 'BACS',
  //         subjectCode1: 'SCN',
  //         designationCode1: 'PGM',
  //         primaryOrgCode: 'ARTSC',
  //         secondaryOrgCode: '',
  //         collaborativeOrgCode: '',
  //         adminOrgCode: 'ARTSC',
  //         coSecondaryOrgCode: '',
  //         yearOfStudy: '',
  //         postAcpDuration: '2',
  //         useSws: 'Y',
  //       },
  //     };

  //     logger.debug('Sending enrollment request:', JSON.stringify(body, null, 2));

  //     const response = await this.page.request.post(enrollUrl, {
  //       headers,
  //       data: body,
  //     });

  //     const responseText = await response.text();
  //     logger.debug('Enrollment response:', responseText);

  //     if (!response.ok()) {
  //       throw new Error(`Enrollment failed: ${response.statusText()} - ${responseText}`);
  //     }

  //     try {
  //       const result = JSON.parse(responseText);
  //       if (result.messages?.errors?.length > 0) {
  //         throw new Error(`Enrollment error: ${result.messages.errors.join(', ')}`);
  //       }
  //     } catch (e) {
  //       logger.error('Failed to parse enrollment response:', e);
  //       throw e;
  //     }

  //     logger.info(`Successfully enrolled in ${config.courseCode} section ${sectionNo}`);
  //   } catch (error) {
  //     logger.error('Failed to enroll:', error);
  //     throw error;
  //   }
  // }
  async close(): Promise<void> {
    await this.browser?.close();
  }
}
