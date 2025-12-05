/**
 * BMAD Diagram Converter
 * Export all modules for programmatic use
 */

const { parseMermaid, validateMermaid, SHAPE_MAPPINGS } = require('./mermaid-parser');
const { toDrawio, convertToDrawio, convertSequenceToDrawio, convertERToDrawio } = require('./drawio-converter');
const { toMarkdown, validationReportToMarkdown } = require('./markdown-converter');
const { convertERToDrawio: convertERToDrawioNew, isERDiagram } = require('./er-converter');

module.exports = {
  // Parser
  parseMermaid,
  validateMermaid,
  SHAPE_MAPPINGS,

  // Converters
  toDrawio,
  toMarkdown,

  // Individual converters
  convertToDrawio,
  convertSequenceToDrawio,
  convertERToDrawio,
  
  // Dedicated ER converter (new)
  convertERToDrawioNew,
  isERDiagram,

  // Utilities
  validationReportToMarkdown,
};
