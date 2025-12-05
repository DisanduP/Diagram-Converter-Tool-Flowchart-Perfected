#!/usr/bin/env node

/**
 * BMAD Diagram Converter CLI
 * Standalone tool for converting Mermaid diagrams to Draw.io XML and Markdown
 *
 * Usage:
 *   node diagram-cli.js <command> [options]
 *
 * Commands:
 *   to-drawio <file>     Convert Mermaid to Draw.io XML
 *   to-markdown <file>   Convert Mermaid to Markdown documentation
 *   convert <file>       Full conversion (both outputs)
 *   validate <file>      Validate Mermaid syntax
 */

const { program } = require('commander');
const fs = require('node:fs');
const path = require('node:path');

const { parseMermaid, validateMermaid } = require('./mermaid-parser');
const { toDrawio } = require('./drawio-converter');
const { toMarkdown, validationReportToMarkdown } = require('./markdown-converter');
const { convertERToDrawio: convertERToDrawioNew, isERDiagram } = require('./er-converter');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

/**
 * Read Mermaid code from file or stdin
 */
function readMermaidInput(fileArg) {
  if (fileArg === '-') {
    // Read from stdin
    return fs.readFileSync(0, 'utf-8');
  }

  const filePath = path.resolve(fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`${colors.red}Error: File not found: ${filePath}${colors.reset}`);
    process.exit(1);
  }

  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Write output to file or stdout
 */
function writeOutput(content, outputPath, defaultExt) {
  if (!outputPath || outputPath === '-') {
    console.log(content);
    return;
  }

  const resolvedPath = path.resolve(outputPath);
  const dir = path.dirname(resolvedPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, content, 'utf-8');
  console.log(`${colors.green}✓${colors.reset} Output written to: ${colors.cyan}${resolvedPath}${colors.reset}`);
}

/**
 * Generate output filename from input
 */
function generateOutputName(inputPath, suffix, ext) {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  return `${baseName}${suffix}.${ext}`;
}

/**
 * Print banner
 */
function printBanner() {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════════╗
║   🔄 BMAD Diagram Converter                                ║
║   Convert Mermaid → Draw.io XML / Markdown                 ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);
}

// Set up CLI
program
  .name('diagram-cli')
  .description('Convert Mermaid diagrams to Draw.io XML and Markdown documentation')
  .version('1.0.0');

// to-drawio command
program
  .command('to-drawio <file>')
  .description('Convert Mermaid diagram to Draw.io XML format')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('-n, --name <name>', 'Diagram name', 'Converted Diagram')
  .option('-q, --quiet', 'Suppress info messages')
  .action((file, options) => {
    if (!options.quiet) printBanner();

    try {
      const mermaidCode = readMermaidInput(file);

      if (!options.quiet) {
        console.log(`${colors.dim}Parsing Mermaid diagram...${colors.reset}`);
      }

      const parsed = parseMermaid(mermaidCode);

      if (!options.quiet) {
        console.log(`${colors.green}✓${colors.reset} Parsed ${parsed.type} diagram with ${parsed.nodes.length} nodes and ${parsed.edges.length} edges`);
        console.log(`${colors.dim}Converting to Draw.io XML...${colors.reset}`);
      }

      // Use dedicated ER converter for ER diagrams
      let xml;
      if (parsed.type === 'erDiagram') {
        xml = convertERToDrawioNew(parsed, { name: options.name });
      } else {
        xml = toDrawio(parsed, { name: options.name });
      }

      const outputPath = options.output || (file !== '-' ? generateOutputName(file, '', 'drawio') : null);
      writeOutput(xml, outputPath, 'drawio');

      if (!options.quiet && outputPath) {
        console.log(`\n${colors.green}✓ Conversion complete!${colors.reset}`);
        console.log(`${colors.dim}Open with Draw.io or VS Code Draw.io extension${colors.reset}`);
      }
    } catch (error) {
      console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  });

// to-markdown command
program
  .command('to-markdown <file>')
  .description('Convert Mermaid diagram to Markdown documentation')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('-q, --quiet', 'Suppress info messages')
  .action((file, options) => {
    if (!options.quiet) printBanner();

    try {
      const mermaidCode = readMermaidInput(file);

      if (!options.quiet) {
        console.log(`${colors.dim}Parsing Mermaid diagram...${colors.reset}`);
      }

      const parsed = parseMermaid(mermaidCode);

      if (!options.quiet) {
        console.log(`${colors.green}✓${colors.reset} Parsed ${parsed.type} diagram with ${parsed.nodes.length} nodes and ${parsed.edges.length} edges`);
        console.log(`${colors.dim}Generating Markdown documentation...${colors.reset}`);
      }

      const markdown = toMarkdown(parsed, mermaidCode);

      const outputPath = options.output || (file !== '-' ? generateOutputName(file, '-docs', 'md') : null);
      writeOutput(markdown, outputPath, 'md');

      if (!options.quiet && outputPath) {
        console.log(`\n${colors.green}✓ Documentation generated!${colors.reset}`);
      }
    } catch (error) {
      console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  });

// convert command (full conversion)
program
  .command('convert <file>')
  .description('Full conversion: generate both Draw.io XML and Markdown')
  .option('-d, --output-dir <dir>', 'Output directory', '.')
  .option('-n, --name <name>', 'Diagram name', 'Converted Diagram')
  .option('-q, --quiet', 'Suppress info messages')
  .action((file, options) => {
    if (!options.quiet) printBanner();

    try {
      const mermaidCode = readMermaidInput(file);

      if (!options.quiet) {
        console.log(`${colors.dim}Parsing Mermaid diagram...${colors.reset}`);
      }

      const parsed = parseMermaid(mermaidCode);

      if (!options.quiet) {
        console.log(`${colors.green}✓${colors.reset} Parsed ${parsed.type} diagram with ${parsed.nodes.length} nodes and ${parsed.edges.length} edges\n`);
      }

      const baseName = file !== '-' ? path.basename(file, path.extname(file)) : 'diagram';
      const outputDir = path.resolve(options.outputDir);

      // Create output directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate Draw.io XML
      if (!options.quiet) {
        console.log(`${colors.dim}1. Converting to Draw.io XML...${colors.reset}`);
      }
      const xml = toDrawio(parsed, { name: options.name });
      const drawioPath = path.join(outputDir, `${baseName}.drawio`);
      fs.writeFileSync(drawioPath, xml, 'utf-8');
      console.log(`   ${colors.green}✓${colors.reset} ${colors.cyan}${drawioPath}${colors.reset}`);

      // Generate Markdown
      if (!options.quiet) {
        console.log(`${colors.dim}2. Generating Markdown documentation...${colors.reset}`);
      }
      const markdown = toMarkdown(parsed, mermaidCode);
      const mdPath = path.join(outputDir, `${baseName}-docs.md`);
      fs.writeFileSync(mdPath, markdown, 'utf-8');
      console.log(`   ${colors.green}✓${colors.reset} ${colors.cyan}${mdPath}${colors.reset}`);

      if (!options.quiet) {
        console.log(`
${colors.green}╔═══════════════════════════════════════════════════════════╗
║   ✅ Conversion Complete!                                  ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}

${colors.bold}Usage Tips:${colors.reset}
  • ${colors.cyan}Draw.io${colors.reset}: Open .drawio file at app.diagrams.net or with VS Code extension
  • ${colors.cyan}Markdown${colors.reset}: View in any Markdown viewer or include in your docs
`);
      }
    } catch (error) {
      console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  });

// validate command
program
  .command('validate <file>')
  .description('Validate Mermaid syntax and check Draw.io compatibility')
  .option('-o, --output <file>', 'Output validation report to file')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress info messages, exit with code only')
  .action((file, options) => {
    if (!options.quiet) printBanner();

    try {
      const mermaidCode = readMermaidInput(file);
      const validation = validateMermaid(mermaidCode);

      // Also try to parse to get node/edge counts
      let parseResult = null;
      try {
        parseResult = parseMermaid(mermaidCode);
        validation.nodeCount = parseResult.nodes.length;
        validation.edgeCount = parseResult.edges.length;
        validation.diagramType = parseResult.type;
      } catch {
        // Parsing failed, counts stay at 0
      }

      if (options.json) {
        console.log(JSON.stringify(validation, null, 2));
      } else if (options.output) {
        const report = validationReportToMarkdown(validation, mermaidCode);
        writeOutput(report, options.output, 'md');
      } else if (!options.quiet) {
        // Pretty print validation results
        const statusIcon = validation.isValid ? `${colors.green}✅ Valid${colors.reset}` : `${colors.red}❌ Invalid${colors.reset}`;
        const compatColors = { high: colors.green, medium: colors.yellow, low: colors.red };
        const compatIcon = `${compatColors[validation.compatibility] || ''}${validation.compatibility.toUpperCase()}${colors.reset}`;

        console.log(`${colors.bold}Validation Results${colors.reset}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Status: ${statusIcon}`);
        console.log(`Draw.io Compatibility: ${compatIcon}`);

        if (parseResult) {
          console.log(`\n${colors.bold}Diagram Info${colors.reset}`);
          console.log(`  Type: ${parseResult.type}`);
          console.log(`  Nodes: ${parseResult.nodes.length}`);
          console.log(`  Edges: ${parseResult.edges.length}`);
        }

        if (validation.issues.length > 0) {
          console.log(`\n${colors.red}${colors.bold}Issues (${validation.issues.length})${colors.reset}`);
          validation.issues.forEach((issue) => {
            console.log(`  ${colors.red}✗${colors.reset} Line ${issue.line}: ${issue.issue}`);
            console.log(`    ${colors.dim}→ ${issue.suggestion}${colors.reset}`);
          });
        }

        if (validation.warnings.length > 0) {
          console.log(`\n${colors.yellow}${colors.bold}Warnings (${validation.warnings.length})${colors.reset}`);
          validation.warnings.forEach((warning) => {
            console.log(`  ${colors.yellow}⚠${colors.reset} Line ${warning.line}: ${warning.issue}`);
            console.log(`    ${colors.dim}→ ${warning.suggestion}${colors.reset}`);
          });
        }

        if (validation.issues.length === 0 && validation.warnings.length === 0) {
          console.log(`\n${colors.green}All checks passed! Ready for conversion.${colors.reset}`);
        }
      }

      // Exit with appropriate code
      process.exit(validation.isValid ? 0 : 1);
    } catch (error) {
      if (!options.quiet) {
        console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
      }
      process.exit(1);
    }
  });

// Help text
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ diagram-cli to-drawio flowchart.mmd -o flowchart.drawio');
  console.log('  $ diagram-cli to-markdown diagram.mmd -o docs.md');
  console.log('  $ diagram-cli convert diagram.mmd -d ./output');
  console.log('  $ diagram-cli validate diagram.mmd --json');
  console.log('  $ cat diagram.mmd | diagram-cli to-drawio - -o out.drawio');
});

// Parse CLI arguments
program.parse(process.argv);

// Show help if no command
if (process.argv.length <= 2) {
  printBanner();
  program.outputHelp();
}
