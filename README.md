# 🐿️ Squirrel

A command-line interface tool for automating UofT Acorn course enrollment. Monitor and automatically enroll in courses when spaces become available.

## Features

- 🔐 Automated login with session persistence
- 📊 Real-time course availability monitoring
- ✨ Automated course enrollment
- 🔄 Automatic retry on server errors
- 🎯 Support for specific lecture/tutorial sections
- 💾 Session persistence between runs

## Prerequisites

- Node.js 14 or later
- pnpm (recommended) or npm

## Installation

```bash
# Using pnpm (recommended)
pnpm add -g squirrel-cli

# Using npm
npm install -g squirrel-cli
```

## Quick Start

1. Login to save your session:

```bash
squirrel login
```

2. Monitor a course:

```bash
squirrel enroll -c CSC108H1 -s F --monitor
```

3. Enroll when space is available:

```bash
squirrel enroll -c CSC108H1 -s F
```

## Detailed Usage Guide

### Authentication

First time setup requires logging in to Acorn:

```bash
squirrel login
```

This will:

1. Open a browser window
2. Let you log in with your UTORid and password
3. Handle Duo 2FA authentication
4. Save the session for future use

The session typically lasts several hours. If you get session expired errors, simply run `login` again.

### Course Monitoring

Monitor course availability without auto-enrolling:

```bash
# Basic monitoring
squirrel enroll -c CSC108H1 -s F --monitor

# Monitor specific lecture sections
squirrel enroll -c CSC108H1 -s F -l 0101,0201 --monitor

# Monitor with custom refresh interval (30 seconds)
squirrel enroll -c CSC108H1 -s F --monitor -w 30

# Monitor tutorial sections
squirrel enroll -c CSC108H1 -s F -t 0101,0102 --monitor
```

### Course Enrollment

Automatically enroll when space becomes available:

```bash
# Basic enrollment (any available section)
squirrel enroll -c CSC108H1 -s F

# Target specific lecture sections
squirrel enroll -c CSC108H1 -s F -l 0101,0201

# Target specific tutorial sections
squirrel enroll -c CSC108H1 -s F -t 0101,0102

# Custom refresh interval
squirrel enroll -c CSC108H1 -s F -w 60  # Check every 60 seconds
```

### Command Line Options

```
Options:
  -c, --course <code>       Course code (e.g., CSC108H1)
  -s, --section <code>      Section code (F/S/Y) (default: "F")
  -w, --wait <seconds>      Wait time between checks (default: "30")
  -t, --tutorial <sections> Tutorial sections (comma separated)
  -l, --lecture <sections>  Lecture sections (comma separated)
  -m, --monitor            Monitor mode - don't enroll, just watch
  -h, --help               Display help for command
```

### Section Codes

- `F`: Fall semester
- `S`: Winter semester
- `Y`: Full year course

## Best Practices

### Session Management

- Start with `squirrel login` to ensure a fresh session
- Re-run login if you get session expired errors
- Sessions are stored in `~/.squirrel/config.json`

### Monitoring Strategy

1. Start with `--monitor` flag to verify correct course targeting
2. Use specific section codes when possible to avoid unwanted enrollments
3. Adjust wait time based on urgency:
   - High urgency: 15-30 seconds
   - Normal: 30-60 seconds
   - Low urgency: 60+ seconds

### Error Handling

- The tool automatically retries on server errors
- If you see persistent errors:
  1. Try logging in again
  2. Check your internet connection
  3. Verify the course code and section are correct

## Troubleshooting

### Common Issues

#### Session Expired

```bash
# Clear your session
rm -rf ~/.squirrel

# Login again
squirrel login
```

#### Course Not Found

- Verify the course code format (e.g., CSC108H1)
- Check the section code (F/S/Y)
- Verify the course is offered in the selected session

#### Enrollment Errors

- Verify you meet course prerequisites
- Check for enrollment blocks
- Ensure you're within your course enrollment period

## FAQ

**Q: Where is my session data stored?**  
A: Session data is stored in `~/.squirrel/config.json`

**Q: How do I clear my session?**  
A: Remove the `.squirrel` folder in your home directory

**Q: What happens if my session expires?**  
A: The tool will notify you to log in again using `squirrel login`

**Q: Is it safe to leave the tool running?**  
A: Yes, the tool handles errors gracefully and will notify you of any issues

## Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/squirrel.git
cd squirrel

# Install dependencies
pnpm install

# Build the project
pnpm build

# Link for local development
pnpm link --global
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Important Notes

- This tool is unofficial and not affiliated with the University of Toronto
- Use responsibly and be mindful of server load
- Consider the implications of automated enrollment
- Respect the university's terms of service

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is provided "as is" without warranty of any kind. Use at your own risk. The developers are not responsible for any issues arising from the use of this tool.
