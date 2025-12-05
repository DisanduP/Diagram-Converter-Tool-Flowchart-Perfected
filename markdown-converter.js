/**
 * Markdown Converter
 * Converts parsed Mermaid diagrams to structured Markdown documentation
 */

/**
 * Get human-readable shape name
 */
function getShapeName(shape) {
  const shapeNames = {
    rectangle: 'Rectangle',
    roundedRect: 'Rounded Rectangle',
    diamond: 'Diamond (Decision)',
    subroutine: 'Subroutine',
    stadium: 'Stadium (Terminal)',
    circle: 'Circle',
  };
  return shapeNames[shape] || shape;
}

/**
 * Get human-readable diagram type name
 */
function getDiagramTypeName(type) {
  const typeNames = {
    flowchart: 'Flowchart',
    sequence: 'Sequence Diagram',
    erDiagram: 'Entity Relationship Diagram',
    class: 'Class Diagram',
    state: 'State Diagram',
    gitgraph: 'Git Graph',
    mindmap: 'Mindmap',
  };
  return typeNames[type] || type;
}

/**
 * Get human-readable direction description
 */
function getDirectionDescription(direction) {
  const directions = {
    TD: 'Top to Bottom',
    TB: 'Top to Bottom',
    BT: 'Bottom to Top',
    LR: 'Left to Right',
    RL: 'Right to Left',
  };
  return directions[direction] || direction;
}

/**
 * Convert flowchart to Markdown
 */
function flowchartToMarkdown(diagram, originalCode) {
  const { nodes, edges, subgraphs, direction } = diagram;
  
  let md = `# Flowchart Documentation

## Overview

This is a **${getDiagramTypeName(diagram.type)}** diagram with a **${getDirectionDescription(direction)}** layout.

- **Total Nodes**: ${nodes.length}
- **Total Connections**: ${edges.length}
- **Subgraphs**: ${subgraphs?.length || 0}

---

## Entities (Nodes)

| ID | Label | Shape | Description |
|----|-------|-------|-------------|
`;

  nodes.forEach((node) => {
    const description = inferNodeDescription(node);
    md += `| \`${node.id}\` | ${node.label} | ${getShapeName(node.shape)} | ${description} |\n`;
  });

  md += `
---

## Relationships (Connections)

| # | From | To | Label | Arrow Type |
|---|------|----|-------|------------|
`;

  edges.forEach((edge, index) => {
    const arrowType = edge.arrowType?.type || 'solid';
    md += `| ${index + 1} | \`${edge.source}\` | \`${edge.target}\` | ${edge.label || '-'} | ${arrowType} |\n`;
  });

  if (subgraphs && subgraphs.length > 0) {
    md += `
---

## Subgraphs (Groups)

`;
    subgraphs.forEach((sg) => {
      md += `### ${sg.label}

**ID**: \`${sg.id}\`

**Contains**: ${sg.nodes.map((n) => `\`${n}\``).join(', ')}

`;
    });
  }

  md += `
---

## Flow Analysis

### Entry Points
${findEntryPoints(nodes, edges).map((n) => `- \`${n.id}\` (${n.label})`).join('\n') || '- None identified'}

### Exit Points
${findExitPoints(nodes, edges).map((n) => `- \`${n.id}\` (${n.label})`).join('\n') || '- None identified'}

### Decision Points
${nodes.filter((n) => n.shape === 'diamond').map((n) => `- \`${n.id}\` (${n.label})`).join('\n') || '- None identified'}

---

## Original Mermaid Code

\`\`\`mermaid
${originalCode}
\`\`\`
`;

  return md;
}

/**
 * Convert sequence diagram to Markdown
 */
function sequenceToMarkdown(diagram, originalCode) {
  const { participants, messages } = diagram;
  
  let md = `# Sequence Diagram Documentation

## Overview

This **Sequence Diagram** shows the interactions between ${participants.length} participant(s).

- **Participants**: ${participants.length}
- **Messages**: ${messages?.length || 0}

---

## Participants

| ID | Name | Type |
|----|------|------|
`;

  participants.forEach((p) => {
    md += `| \`${p.id}\` | ${p.label} | ${p.isActor ? 'Actor' : 'Participant'} |\n`;
  });

  if (messages && messages.length > 0) {
    md += `
---

## Message Sequence

| # | From | To | Message | Type |
|---|------|----|---------|------|
`;

    messages.forEach((msg, index) => {
      const type = msg.type === 'dashed' ? 'Response' : 'Request';
      const asyncFlag = msg.isAsync ? ' (async)' : '';
      md += `| ${index + 1} | \`${msg.from}\` | \`${msg.to}\` | ${msg.message} | ${type}${asyncFlag} |\n`;
    });
  }

  md += `
---

## Interaction Summary

`;

  // Count interactions per participant
  const interactions = new Map();
  participants.forEach((p) => interactions.set(p.id, { sent: 0, received: 0 }));
  
  messages?.forEach((msg) => {
    if (interactions.has(msg.from)) {
      interactions.get(msg.from).sent++;
    }
    if (interactions.has(msg.to)) {
      interactions.get(msg.to).received++;
    }
  });

  md += `| Participant | Messages Sent | Messages Received |
|-------------|---------------|-------------------|
`;
  
  interactions.forEach((counts, id) => {
    const participant = participants.find((p) => p.id === id);
    md += `| ${participant?.label || id} | ${counts.sent} | ${counts.received} |\n`;
  });

  md += `
---

## Original Mermaid Code

\`\`\`mermaid
${originalCode}
\`\`\`
`;

  return md;
}

/**
 * Convert ER diagram to Markdown
 */
function erToMarkdown(diagram, originalCode) {
  const { entities, relationships } = diagram;
  
  let md = `# Entity Relationship Diagram Documentation

## Overview

This **ER Diagram** defines ${entities.length} entity(ies) and ${relationships?.length || 0} relationship(s).

---

## Entities

`;

  entities.forEach((entity) => {
    md += `### ${entity.label}

**ID**: \`${entity.id}\`

`;
    
    if (entity.attributes && entity.attributes.length > 0) {
      md += `**Attributes**:

| Type | Name |
|------|------|
`;
      entity.attributes.forEach((attr) => {
        md += `| ${attr.type} | ${attr.name} |\n`;
      });
      md += '\n';
    } else {
      md += '*No attributes defined*\n\n';
    }
  });

  if (relationships && relationships.length > 0) {
    md += `---

## Relationships

| # | Entity 1 | Cardinality | Entity 2 | Description |
|---|----------|-------------|----------|-------------|
`;

    relationships.forEach((rel, index) => {
      const cardinality = `${rel.cardinality1 || ''} → ${rel.cardinality2 || ''}`;
      md += `| ${index + 1} | \`${rel.source}\` | ${cardinality} | \`${rel.target}\` | ${rel.label || '-'} |\n`;
    });
  }

  md += `
---

## Data Model Summary

- **Total Entities**: ${entities.length}
- **Total Relationships**: ${relationships?.length || 0}
- **Total Attributes**: ${entities.reduce((sum, e) => sum + (e.attributes?.length || 0), 0)}

---

## Original Mermaid Code

\`\`\`mermaid
${originalCode}
\`\`\`
`;

  return md;
}

/**
 * Infer a description based on node characteristics
 */
function inferNodeDescription(node) {
  const label = node.label.toLowerCase();
  
  if (node.shape === 'stadium') {
    if (label.includes('start') || label.includes('begin')) return 'Process start point';
    if (label.includes('end') || label.includes('finish')) return 'Process end point';
    return 'Terminal node';
  }
  
  if (node.shape === 'diamond') {
    return 'Decision/branching point';
  }
  
  if (node.shape === 'subroutine') {
    return 'Subprocess or external routine';
  }
  
  if (node.shape === 'circle') {
    return 'Connection point or state';
  }
  
  return 'Process step';
}

/**
 * Find entry points (nodes with no incoming edges)
 */
function findEntryPoints(nodes, edges) {
  const hasIncoming = new Set(edges.map((e) => e.target));
  return nodes.filter((n) => !hasIncoming.has(n.id));
}

/**
 * Find exit points (nodes with no outgoing edges)
 */
function findExitPoints(nodes, edges) {
  const hasOutgoing = new Set(edges.map((e) => e.source));
  return nodes.filter((n) => !hasOutgoing.has(n.id));
}

/**
 * Convert mindmap to Markdown
 */
function mindmapToMarkdown(diagram, originalCode) {
  const { nodes, edges } = diagram;

  // Build parent-child relationships
  const children = new Map();
  edges.forEach((edge) => {
    if (!children.has(edge.source)) {
      children.set(edge.source, []);
    }
    children.get(edge.source).push(edge.target);
  });

  // Find root node(s)
  const rootNodes = nodes.filter((n) => n.level === 0);

  let md = `# Mindmap Documentation

## Overview

This **Mindmap** visualizes ideas and concepts in a hierarchical structure.

- **Total Topics**: ${nodes.length}
- **Total Connections**: ${edges.length}
- **Depth Levels**: ${Math.max(...nodes.map((n) => n.level)) + 1}

---

## Structure

`;

  // Render hierarchy as nested list
  function renderNode(nodeId, indent = '') {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return '';

    let result = `${indent}- **${node.label}**\n`;
    const nodeChildren = children.get(nodeId) || [];
    nodeChildren.forEach((childId) => {
      result += renderNode(childId, indent + '  ');
    });
    return result;
  }

  rootNodes.forEach((root) => {
    md += renderNode(root.id);
  });

  md += `
---

## Topics by Level

`;

  // Group by level
  const levelNodes = new Map();
  nodes.forEach((node) => {
    if (!levelNodes.has(node.level)) {
      levelNodes.set(node.level, []);
    }
    levelNodes.get(node.level).push(node);
  });

  const levelNames = ['🎯 Central Topic', '📌 Main Branches', '📝 Sub-topics', '💡 Details', '📎 Notes'];

  levelNodes.forEach((levelNodeList, level) => {
    md += `### ${levelNames[level] || `Level ${level}`}

`;
    levelNodeList.forEach((node) => {
      md += `- ${node.label}\n`;
    });
    md += '\n';
  });

  md += `---

## Original Mermaid Code

\`\`\`mermaid
${originalCode}
\`\`\`
`;

  return md;
}

/**
 * Main conversion function
 */
function toMarkdown(parsedDiagram, originalCode) {
  // Clean up original code
  let cleanCode = originalCode.trim();
  if (cleanCode.startsWith('```mermaid')) {
    cleanCode = cleanCode.replace(/^```mermaid\n?/, '').replace(/\n?```$/, '');
  } else if (cleanCode.startsWith('```')) {
    cleanCode = cleanCode.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  
  switch (parsedDiagram.type) {
    case 'sequence':
      return sequenceToMarkdown(parsedDiagram, cleanCode);
    case 'erDiagram':
      return erToMarkdown(parsedDiagram, cleanCode);
    case 'mindmap':
      return mindmapToMarkdown(parsedDiagram, cleanCode);
    case 'flowchart':
    default:
      return flowchartToMarkdown(parsedDiagram, cleanCode);
  }
}

/**
 * Generate a validation report in Markdown
 */
function validationReportToMarkdown(validation, originalCode) {
  const statusIcon = validation.isValid ? '✅ Valid' : '❌ Invalid';
  const compatIcon = {
    high: '🟢 High',
    medium: '🟡 Medium',
    low: '🔴 Low',
  }[validation.compatibility] || '⚪ Unknown';
  
  let md = `# Mermaid Validation Report

## Summary

**Status**: ${statusIcon}
**Draw.io Compatibility**: ${compatIcon}

---

## Checklist

`;

  if (validation.issues.length === 0 && validation.warnings.length === 0) {
    md += `- ✅ All checks passed\n`;
  } else {
    md += `- ${validation.issues.length === 0 ? '✅' : '❌'} Syntax validation\n`;
    md += `- ${validation.warnings.length === 0 ? '✅' : '⚠️'} Best practices\n`;
  }

  if (validation.issues.length > 0) {
    md += `
---

## Issues Found

| Line | Issue | Suggestion |
|------|-------|------------|
`;
    validation.issues.forEach((issue) => {
      md += `| ${issue.line} | ${issue.issue} | ${issue.suggestion} |\n`;
    });
  }

  if (validation.warnings.length > 0) {
    md += `
---

## Warnings

| Line | Warning | Suggestion |
|------|---------|------------|
`;
    validation.warnings.forEach((warning) => {
      md += `| ${warning.line} | ${warning.issue} | ${warning.suggestion} |\n`;
    });
  }

  md += `
---

## Original Code

\`\`\`mermaid
${originalCode}
\`\`\`
`;

  return md;
}

module.exports = {
  toMarkdown,
  validationReportToMarkdown,
  flowchartToMarkdown,
  sequenceToMarkdown,
  erToMarkdown,
};
