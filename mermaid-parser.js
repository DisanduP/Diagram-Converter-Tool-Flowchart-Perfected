/**
 * Mermaid Diagram Parser
 * Parses Mermaid diagram syntax into a structured representation
 */

/**
 * Shape mappings from Mermaid to Draw.io styles
 * IMPORTANT: Order matters! More specific patterns must come first.
 * E.g., stadium ([...]) must be checked before roundedRect (...) 
 * E.g., circle ((...)) must be checked before roundedRect (...)
 * E.g., subroutine [[...]] must be checked before rectangle [...]
 */
const SHAPE_MAPPINGS = {
  // Most specific patterns first (multi-character delimiters)
  stadium: {
    pattern: /^\(\[([^\]]+)\]\)$/,
    style: 'rounded=1;arcSize=50;whiteSpace=wrap;html=1;',
    fillColor: '#d5e8d4',
    strokeColor: '#82b366',
  },
  circle: {
    pattern: /^\(\(([^)]+)\)\)$/,
    style: 'ellipse;whiteSpace=wrap;html=1;',
    fillColor: '#f8cecc',
    strokeColor: '#b85450',
  },
  subroutine: {
    pattern: /^\[\[([^\]]+)\]\]$/,
    style: 'shape=process;whiteSpace=wrap;html=1;',
    fillColor: '#e1d5e7',
    strokeColor: '#9673a6',
  },
  // Less specific patterns (single-character delimiters)
  rectangle: {
    pattern: /^\[([^\]]+)\]$/,
    style: 'rounded=0;whiteSpace=wrap;html=1;',
    fillColor: '#dae8fc',
    strokeColor: '#6c8ebf',
  },
  roundedRect: {
    pattern: /^\(([^)]+)\)$/,
    style: 'rounded=1;whiteSpace=wrap;html=1;',
    fillColor: '#fff2cc',
    strokeColor: '#d6b656',
  },
  diamond: {
    pattern: /^\{([^}]+)\}$/,
    style: 'rhombus;whiteSpace=wrap;html=1;',
    fillColor: '#ffe6cc',
    strokeColor: '#d79b00',
  },
};

/**
 * Parse a Mermaid node definition to extract shape and label
 */
function parseNodeShape(nodeContent) {
  for (const [shapeName, config] of Object.entries(SHAPE_MAPPINGS)) {
    const match = nodeContent.match(config.pattern);
    if (match) {
      return {
        shape: shapeName,
        label: match[1].trim(),
        style: config.style,
        fillColor: config.fillColor,
        strokeColor: config.strokeColor,
      };
    }
  }
  // Default to rectangle if no shape markers
  return {
    shape: 'rectangle',
    label: nodeContent.trim(),
    style: SHAPE_MAPPINGS.rectangle.style,
    fillColor: SHAPE_MAPPINGS.rectangle.fillColor,
    strokeColor: SHAPE_MAPPINGS.rectangle.strokeColor,
  };
}

/**
 * Parse arrow types
 */
function parseArrow(arrowStr) {
  const arrowTypes = {
    '-->': { type: 'solid', arrow: 'classic' },
    '---': { type: 'solid', arrow: 'none' },
    '-.->': { type: 'dashed', arrow: 'classic' },
    '-.-': { type: 'dashed', arrow: 'none' },
    '==>': { type: 'thick', arrow: 'classic' },
    '-->|': { type: 'solid', arrow: 'classic', hasLabel: true },
    '--|': { type: 'solid', arrow: 'none', hasLabel: true },
  };
  
  for (const [pattern, config] of Object.entries(arrowTypes)) {
    if (arrowStr.includes(pattern)) {
      return config;
    }
  }
  return { type: 'solid', arrow: 'classic' };
}

/**
 * Parse a connection line (e.g., "A --> B" or "A -->|label| B" or "A[Label] --> B")
 */
function parseConnection(line) {
  // Match patterns like: A --> B, A -->|label| B, A[Label] --> B, A([Start]) --> B
  // Source can have shape definition: SourceId or SourceId[label] or SourceId([label]) etc.
  const connectionPattern = /^(\w+)([\[\(\{].*?[\]\)\}])?\s*(-->|---|-\.->|-\.-|==>)(\|([^|]*)\|)?\s*(.+)$/;
  const match = line.match(connectionPattern);
  
  if (!match) return null;
  
  const [, sourceId, sourceShape, arrow, , edgeLabel, targetPart] = match;
  const arrowConfig = parseArrow(arrow);
  
  // Parse source node if it has a shape
  let sourceNode = null;
  if (sourceShape) {
    const shapeInfo = parseNodeShape(sourceShape);
    sourceNode = {
      id: sourceId,
      ...shapeInfo,
    };
  }
  
  // Parse target - could be just ID or ID with shape definition
  let targetId = targetPart.trim();
  let targetNode = null;
  
  // Check if target has inline definition (e.g., B[Label] or B{Decision} or B([End]))
  const inlineDefMatch = targetPart.match(/^(\w+)([\[\(\{].*?[\]\)\}])$/);
  if (inlineDefMatch) {
    targetId = inlineDefMatch[1];
    const shapeInfo = parseNodeShape(inlineDefMatch[2]);
    targetNode = {
      id: targetId,
      ...shapeInfo,
    };
  }
  
  return {
    source: sourceId,
    target: targetId,
    label: edgeLabel || '',
    arrowType: arrowConfig,
    sourceNode,
    targetNode,
  };
}

/**
 * Detect diagram type from first line
 */
function detectDiagramType(lines) {
  const firstLine = lines[0].trim().toLowerCase();
  
  if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) {
    const direction = firstLine.match(/\b(td|tb|bt|lr|rl)\b/i)?.[1]?.toUpperCase() || 'TD';
    return { type: 'flowchart', direction };
  }
  if (firstLine.startsWith('sequencediagram')) {
    return { type: 'sequence', direction: null };
  }
  if (firstLine.startsWith('classdiagram')) {
    return { type: 'class', direction: null };
  }
  if (firstLine.startsWith('erdiagram')) {
    return { type: 'erDiagram', direction: null };
  }
  if (firstLine.startsWith('statediagram')) {
    return { type: 'state', direction: null };
  }
  if (firstLine.startsWith('gitgraph')) {
    return { type: 'gitgraph', direction: null };
  }
  if (firstLine.startsWith('mindmap')) {
    return { type: 'mindmap', direction: null };
  }
  
  return { type: 'unknown', direction: null };
}

/**
 * Parse a flowchart diagram
 */
function parseFlowchart(lines, direction) {
  const nodes = new Map();
  const edges = [];
  const subgraphs = [];
  let currentSubgraph = null;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;
    
    // Subgraph start
    if (line.startsWith('subgraph')) {
      const subgraphMatch = line.match(/subgraph\s+(\w+)(?:\s*\[([^\]]+)\])?/);
      if (subgraphMatch) {
        currentSubgraph = {
          id: subgraphMatch[1],
          label: subgraphMatch[2] || subgraphMatch[1],
          nodes: [],
        };
      }
      continue;
    }
    
    // Subgraph end
    if (line === 'end') {
      if (currentSubgraph) {
        subgraphs.push(currentSubgraph);
        currentSubgraph = null;
      }
      continue;
    }
    
    // Try to parse as connection
    const connection = parseConnection(line);
    if (connection) {
      // Add source node - use sourceNode info if available
      if (connection.sourceNode) {
        nodes.set(connection.source, connection.sourceNode);
      } else if (!nodes.has(connection.source)) {
        nodes.set(connection.source, {
          id: connection.source,
          label: connection.source,
          shape: 'rectangle',
          style: SHAPE_MAPPINGS.rectangle.style,
          fillColor: SHAPE_MAPPINGS.rectangle.fillColor,
          strokeColor: SHAPE_MAPPINGS.rectangle.strokeColor,
        });
      }
      
      // Add target node
      if (connection.targetNode) {
        nodes.set(connection.target, connection.targetNode);
      } else if (!nodes.has(connection.target)) {
        nodes.set(connection.target, {
          id: connection.target,
          label: connection.target,
          shape: 'rectangle',
          style: SHAPE_MAPPINGS.rectangle.style,
          fillColor: SHAPE_MAPPINGS.rectangle.fillColor,
          strokeColor: SHAPE_MAPPINGS.rectangle.strokeColor,
        });
      }
      
      // Add to subgraph if active
      if (currentSubgraph) {
        if (!currentSubgraph.nodes.includes(connection.source)) {
          currentSubgraph.nodes.push(connection.source);
        }
        if (!currentSubgraph.nodes.includes(connection.target)) {
          currentSubgraph.nodes.push(connection.target);
        }
      }
      
      edges.push({
        id: `e${edges.length + 1}`,
        source: connection.source,
        target: connection.target,
        label: connection.label,
        arrowType: connection.arrowType,
      });
      continue;
    }
    
    // Try to parse as standalone node definition
    const nodeDefMatch = line.match(/^(\w+)([\[\(\{].+[\]\)\}])$/);
    if (nodeDefMatch) {
      const nodeId = nodeDefMatch[1];
      const shapeInfo = parseNodeShape(nodeDefMatch[2]);
      nodes.set(nodeId, {
        id: nodeId,
        ...shapeInfo,
      });
      
      if (currentSubgraph) {
        currentSubgraph.nodes.push(nodeId);
      }
    }
  }
  
  return {
    type: 'flowchart',
    direction,
    nodes: Array.from(nodes.values()),
    edges,
    subgraphs,
  };
}

/**
 * Parse a sequence diagram
 */
function parseSequenceDiagram(lines) {
  const participants = [];
  const messages = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;
    
    // Participant declaration
    const participantMatch = line.match(/participant\s+(\w+)(?:\s+as\s+(.+))?/);
    if (participantMatch) {
      participants.push({
        id: participantMatch[1],
        label: participantMatch[2] || participantMatch[1],
      });
      continue;
    }
    
    // Actor declaration
    const actorMatch = line.match(/actor\s+(\w+)(?:\s+as\s+(.+))?/);
    if (actorMatch) {
      participants.push({
        id: actorMatch[1],
        label: actorMatch[2] || actorMatch[1],
        isActor: true,
      });
      continue;
    }
    
    // Message
    const messageMatch = line.match(/(\w+)\s*(->>?|-->>?|-)>?\s*(\w+)\s*:\s*(.+)/);
    if (messageMatch) {
      messages.push({
        from: messageMatch[1],
        to: messageMatch[3],
        message: messageMatch[4],
        type: messageMatch[2].includes('--') ? 'dashed' : 'solid',
        isAsync: messageMatch[2].includes('>>'),
      });
    }
  }
  
  return {
    type: 'sequence',
    participants,
    messages,
    nodes: participants,
    edges: messages.map((m, i) => ({
      id: `e${i + 1}`,
      source: m.from,
      target: m.to,
      label: m.message,
    })),
  };
}

/**
 * Parse an ER diagram
 */
function parseERDiagram(lines) {
  const entities = new Map();
  const relationships = [];
  let currentEntity = null;
  let inEntityBlock = false;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;
    
    // Check for closing brace (end of entity block)
    if (line === '}') {
      inEntityBlock = false;
      currentEntity = null;
      continue;
    }
    
    // Check for entity block start: ENTITY {
    const entityBlockStart = line.match(/^(\w+)\s*\{$/);
    if (entityBlockStart) {
      const entityName = entityBlockStart[1];
      if (!entities.has(entityName)) {
        entities.set(entityName, { id: entityName, label: entityName, attributes: [] });
      }
      currentEntity = entities.get(entityName);
      inEntityBlock = true;
      continue;
    }
    
    // Parse attribute inside entity block
    if (inEntityBlock && currentEntity) {
      const attrMatch = line.match(/^(\w+)\s+(\w+)\s*$/);
      if (attrMatch) {
        const [, attrType, attrName] = attrMatch;
        currentEntity.attributes.push({ type: attrType, name: attrName });
        continue;
      }
    }
    
    // Relationship line: ENTITY1 ||--o{ ENTITY2 : "relationship"
    // Updated regex to handle more cardinality patterns
    const relMatch = line.match(/(\w+)\s*(\|\||\|o|o\||o\{|\{o|\}\||\|\{|\{|)\s*--\s*(\|\||\|o|o\||\{o|o\{|\|\{|\}\|||\{)\s*(\w+)\s*:\s*"?([^"]+)"?/);
    if (relMatch) {
      const [, entity1, card1, card2, entity2, label] = relMatch;
      
      if (!entities.has(entity1)) {
        entities.set(entity1, { id: entity1, label: entity1, attributes: [] });
      }
      if (!entities.has(entity2)) {
        entities.set(entity2, { id: entity2, label: entity2, attributes: [] });
      }
      
      relationships.push({
        id: `r${relationships.length + 1}`,
        source: entity1,
        target: entity2,
        cardinality1: card1 || '||',
        cardinality2: card2 || '||',
        label: label.trim(),
      });
      continue;
    }
    
    // Single-line entity attribute: ENTITY { type attribute }
    const singleLineAttrMatch = line.match(/(\w+)\s*\{\s*(\w+)\s+(\w+)\s*\}/);
    if (singleLineAttrMatch) {
      const [, entityName, attrType, attrName] = singleLineAttrMatch;
      if (!entities.has(entityName)) {
        entities.set(entityName, { id: entityName, label: entityName, attributes: [] });
      }
      entities.get(entityName).attributes.push({ type: attrType, name: attrName });
      continue;
    }
  }
  
  return {
    type: 'erDiagram',
    entities: Array.from(entities.values()),
    relationships,
    nodes: Array.from(entities.values()),
    edges: relationships,
  };
}

/**
 * Parse a mindmap diagram
 */
function parseMindmap(lines) {
  const nodes = [];
  const edges = [];
  const nodeStack = []; // Stack to track parent nodes at each indent level
  let nodeId = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Calculate indent level (2 spaces = 1 level)
    const indent = line.search(/\S/);
    const level = Math.floor(indent / 2);
    const content = line.trim();

    // Parse node content - handle root((text)), (text), [text], or plain text
    let label = content;
    let shape = 'rectangle';
    
    // Root node with (( ))
    const rootMatch = content.match(/^root\(\((.+)\)\)$/);
    if (rootMatch) {
      label = rootMatch[1];
      shape = 'circle';
    }
    // Rounded with ( )
    else if (content.match(/^\((.+)\)$/)) {
      label = content.match(/^\((.+)\)$/)[1];
      shape = 'roundedRect';
    }
    // Square with [ ]
    else if (content.match(/^\[(.+)\]$/)) {
      label = content.match(/^\[(.+)\]$/)[1];
      shape = 'rectangle';
    }

    const node = {
      id: `node${nodeId++}`,
      label,
      shape,
      level,
      style: shape === 'circle' 
        ? 'ellipse;whiteSpace=wrap;html=1;'
        : shape === 'roundedRect'
        ? 'rounded=1;whiteSpace=wrap;html=1;'
        : 'rounded=0;whiteSpace=wrap;html=1;',
      fillColor: getLevelColor(level),
      strokeColor: getLevelStrokeColor(level),
    };

    nodes.push(node);

    // Update stack and create edge to parent
    nodeStack[level] = node;
    
    if (level > 0 && nodeStack[level - 1]) {
      edges.push({
        id: `e${edges.length + 1}`,
        source: nodeStack[level - 1].id,
        target: node.id,
        label: '',
      });
    }
  }

  return {
    type: 'mindmap',
    nodes,
    edges,
    direction: 'LR', // Mindmaps typically flow left-to-right
  };
}

/**
 * Get fill color based on mindmap level
 */
function getLevelColor(level) {
  const colors = [
    '#f8cecc', // Level 0 - Red (root)
    '#dae8fc', // Level 1 - Blue
    '#d5e8d4', // Level 2 - Green
    '#fff2cc', // Level 3 - Yellow
    '#e1d5e7', // Level 4 - Purple
    '#ffe6cc', // Level 5 - Orange
  ];
  return colors[level % colors.length];
}

/**
 * Get stroke color based on mindmap level
 */
function getLevelStrokeColor(level) {
  const colors = [
    '#b85450', // Level 0 - Red
    '#6c8ebf', // Level 1 - Blue
    '#82b366', // Level 2 - Green
    '#d6b656', // Level 3 - Yellow
    '#9673a6', // Level 4 - Purple
    '#d79b00', // Level 5 - Orange
  ];
  return colors[level % colors.length];
}

/**
 * Main parser function
 */
function parseMermaid(mermaidCode) {
  // Clean up the code - remove markdown fences if present
  let code = mermaidCode.trim();
  if (code.startsWith('```mermaid')) {
    code = code.replace(/^```mermaid\n?/, '').replace(/\n?```$/, '');
  } else if (code.startsWith('```')) {
    code = code.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  
  const lines = code.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim());
  
  if (nonEmptyLines.length === 0) {
    throw new Error('Empty Mermaid diagram');
  }
  
  const { type, direction } = detectDiagramType(nonEmptyLines);
  
  switch (type) {
    case 'flowchart':
      return parseFlowchart(nonEmptyLines, direction);
    case 'sequence':
      return parseSequenceDiagram(nonEmptyLines);
    case 'erDiagram':
      return parseERDiagram(nonEmptyLines);
    case 'mindmap':
      return parseMindmap(lines); // Pass original lines to preserve indentation
    default:
      // Fall back to flowchart parsing for unknown types
      return parseFlowchart(nonEmptyLines, direction || 'TD');
  }
}

/**
 * Validate Mermaid code against conversion rules
 */
function validateMermaid(mermaidCode) {
  const issues = [];
  const warnings = [];
  
  let code = mermaidCode.trim();
  if (code.startsWith('```mermaid')) {
    code = code.replace(/^```mermaid\n?/, '').replace(/\n?```$/, '');
  }
  
  const lines = code.split('\n');
  const firstLine = lines[0]?.trim().toLowerCase() || '';
  
  // Check diagram type declaration
  const validTypes = ['flowchart', 'graph', 'sequencediagram', 'classdiagram', 'erdiagram', 'statediagram', 'gitgraph', 'mindmap'];
  const hasValidType = validTypes.some((t) => firstLine.startsWith(t));
  if (!hasValidType) {
    issues.push({ line: 1, issue: 'Missing or invalid diagram type declaration', suggestion: 'Start with flowchart TD, sequenceDiagram, etc.' });
  }
  
  // Check direction for flowcharts
  if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) {
    if (!/\b(td|tb|bt|lr|rl)\b/i.test(firstLine)) {
      warnings.push({ line: 1, issue: 'Direction not specified', suggestion: 'Add direction: TD, LR, RL, or BT' });
    }
  }
  
  // Check for styling (not recommended for conversion)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('classDef') || line.startsWith('style ')) {
      warnings.push({ line: i + 1, issue: 'Styling directive found', suggestion: 'Styling may not convert cleanly to Draw.io' });
    }
    
    // Check for chained arrows
    const arrowCount = (line.match(/-->/g) || []).length;
    if (arrowCount > 1) {
      issues.push({ line: i + 1, issue: 'Chained arrows detected', suggestion: 'Break into separate lines: A --> B and B --> C' });
    }
    
    // Check for non-alphanumeric IDs (excluding underscores)
    // Match node definitions like "NodeId[label]" or "NodeId([label])" etc
    const nodeDefMatch = line.match(/^\s*(\w+)\s*[\[\(\{]/);
    if (nodeDefMatch) {
      const nodeId = nodeDefMatch[1];
      if (!/^\w+$/.test(nodeId)) {
        issues.push({ line: i + 1, issue: `Invalid node ID: ${nodeId}`, suggestion: 'Use only alphanumeric characters and underscores' });
      }
    }
    
    // Check for IDs in connections (A --> B)
    const connMatch = line.match(/^\s*(\w+)\s*--/);
    if (connMatch && !/^\w+$/.test(connMatch[1])) {
      issues.push({ line: i + 1, issue: `Invalid node ID: ${connMatch[1]}`, suggestion: 'Use only alphanumeric characters and underscores' });
    }
  }
  
  const isValid = issues.length === 0;
  const compatibility = issues.length === 0 ? (warnings.length === 0 ? 'high' : 'medium') : 'low';
  
  return {
    isValid,
    compatibility,
    issues,
    warnings,
    nodeCount: 0, // Will be calculated by parser
    edgeCount: 0,
  };
}

module.exports = {
  parseMermaid,
  validateMermaid,
  parseNodeShape,
  SHAPE_MAPPINGS,
};
