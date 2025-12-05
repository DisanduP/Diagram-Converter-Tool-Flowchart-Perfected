/**
 * Dedicated ER Diagram Converter
 * Converts parsed Mermaid ER diagrams to Draw.io XML format
 * 
 * This is a separate converter specifically for ER diagrams
 * to avoid affecting flowchart, sequence, and mindmap converters.
 */

/**
 * Generate a unique ID for Draw.io elements
 */
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse cardinality notation to Draw.io arrow style
 * Mermaid: ||, o|, |o, o{, }|, |{, {o, }o
 * Draw.io: ERone, ERzeroToOne, ERoneToMany, ERzeroToMany, etc.
 */
function getCardinalityStyle(cardinality, isStart) {
  const prefix = isStart ? 'start' : 'end';
  
  // Map Mermaid cardinality to Draw.io notation
  const cardMap = {
    '||': `${prefix}Arrow=ERone;${prefix}Fill=0;`,
    'o|': `${prefix}Arrow=ERzeroToOne;${prefix}Fill=0;`,
    '|o': `${prefix}Arrow=ERzeroToOne;${prefix}Fill=0;`,
    'o{': `${prefix}Arrow=ERzeroToMany;${prefix}Fill=0;`,
    '}o': `${prefix}Arrow=ERzeroToMany;${prefix}Fill=0;`,
    '{o': `${prefix}Arrow=ERzeroToMany;${prefix}Fill=0;`,
    '|{': `${prefix}Arrow=ERoneToMany;${prefix}Fill=0;`,
    '}|': `${prefix}Arrow=ERoneToMany;${prefix}Fill=0;`,
    '{|': `${prefix}Arrow=ERoneToMany;${prefix}Fill=0;`,
  };
  
  return cardMap[cardinality] || `${prefix}Arrow=ERone;${prefix}Fill=0;`;
}

/**
 * Calculate entity positions using a smart layout
 * Places junction tables in the center, main entities on the sides
 */
function calculateERPositions(entities, relationships) {
  const positions = new Map();
  const entityWidth = 180;
  const entityBaseHeight = 40; // Header height
  const attributeHeight = 24;
  const horizontalGap = 300;
  const verticalGap = 250;
  const startX = 100;
  const startY = 60;
  
  // Build adjacency map for relationship-based positioning
  const connections = new Map();
  entities.forEach((e) => connections.set(e.id, new Set()));
  
  relationships.forEach((rel) => {
    connections.get(rel.source)?.add(rel.target);
    connections.get(rel.target)?.add(rel.source);
  });
  
  // Identify junction tables (entities that appear as targets in multiple relationships)
  const targetCount = new Map();
  relationships.forEach((rel) => {
    targetCount.set(rel.target, (targetCount.get(rel.target) || 0) + 1);
  });
  
  // Find junction tables (entities targeted by 2+ relationships)
  const junctionTables = entities.filter(e => (targetCount.get(e.id) || 0) >= 2);
  const mainEntities = entities.filter(e => (targetCount.get(e.id) || 0) < 2);
  
  // Calculate entity height helper
  const getEntityHeight = (entity) => {
    const attrCount = entity.attributes?.length || 0;
    return Math.max(entityBaseHeight + (attrCount * attributeHeight), 60);
  };
  
  // Special layout for 3 entities with junction table pattern
  if (entities.length === 3 && junctionTables.length === 1) {
    const junction = junctionTables[0];
    const others = mainEntities;
    
    // Place junction table in the center-bottom
    positions.set(junction.id, {
      x: startX + horizontalGap,
      y: startY + verticalGap,
      width: entityWidth,
      height: getEntityHeight(junction),
    });
    
    // Place main entities on left and right at the top
    others.forEach((entity, index) => {
      positions.set(entity.id, {
        x: startX + (index * horizontalGap * 2),
        y: startY,
        width: entityWidth,
        height: getEntityHeight(entity),
      });
    });
  } else {
    // Default grid layout for other cases
    const numEntities = entities.length;
    let cols = Math.ceil(Math.sqrt(numEntities));
    if (cols < 2) cols = 2;
    if (numEntities <= 3) cols = numEntities;
    if (numEntities === 4) cols = 2;
    
    let row = 0;
    let col = 0;
    
    entities.forEach((entity) => {
      const x = startX + col * horizontalGap;
      const y = startY + row * verticalGap;
      
      positions.set(entity.id, {
        x,
        y,
        width: entityWidth,
        height: getEntityHeight(entity),
      });
      
      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    });
  }
  
  return positions;
}

/**
 * Convert ER diagram to Draw.io XML
 */
function convertERToDrawio(parsedDiagram, options = {}) {
  const { name = 'ER Diagram' } = options;
  const diagramId = generateId();
  
  const entities = parsedDiagram.entities || parsedDiagram.nodes || [];
  const relationships = parsedDiagram.relationships || parsedDiagram.edges || [];
  
  // Calculate positions
  const positions = calculateERPositions(entities, relationships);
  
  // Build entities XML with proper ER table styling
  const entitiesXml = entities.map((entity) => {
    const pos = positions.get(entity.id) || { x: 100, y: 100, width: 180, height: 60 };
    const label = escapeXml(entity.label);
    const attrCount = entity.attributes?.length || 0;
    
    // ER entity table style - professional database table look
    const tableStyle = 'swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=30;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;rounded=0;';
    
    // Build the entity table cell
    let entityXml = `        <mxCell id="${entity.id}" value="${label}" style="${tableStyle}" vertex="1" parent="1">
          <mxGeometry x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" as="geometry"/>
        </mxCell>`;
    
    // Add attribute rows
    if (entity.attributes && entity.attributes.length > 0) {
      entity.attributes.forEach((attr, i) => {
        const attrStyle = 'text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=4;spacingRight=4;overflow=hidden;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;rotatable=0;whiteSpace=wrap;html=1;';
        const attrLabel = escapeXml(`${attr.type} ${attr.name}`);
        const yOffset = 30 + (i * 24);
        
        entityXml += `
        <mxCell id="${entity.id}_attr${i}" value="${attrLabel}" style="${attrStyle}" vertex="1" parent="${entity.id}">
          <mxGeometry y="${yOffset}" width="${pos.width}" height="24" as="geometry"/>
        </mxCell>`;
      });
    } else {
      // Add placeholder if no attributes
      const placeholderStyle = 'text;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;spacingLeft=4;spacingRight=4;overflow=hidden;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;rotatable=0;whiteSpace=wrap;html=1;fontStyle=2;fontColor=#999999;';
      entityXml += `
        <mxCell id="${entity.id}_placeholder" value="(no attributes)" style="${placeholderStyle}" vertex="1" parent="${entity.id}">
          <mxGeometry y="30" width="${pos.width}" height="24" as="geometry"/>
        </mxCell>`;
    }
    
    return entityXml;
  }).join('\n');
  
  // Build relationships XML with proper ER notation
  const relationshipsXml = relationships.map((rel, index) => {
    const sourcePos = positions.get(rel.source);
    const targetPos = positions.get(rel.target);
    if (!sourcePos || !targetPos) return '';
    
    const label = escapeXml(rel.label || '');
    
    // Get cardinality styles
    const startStyle = getCardinalityStyle(rel.cardinality1, true);
    const endStyle = getCardinalityStyle(rel.cardinality2, false);
    
    // ER relationship edge style - use orthogonal for cleaner lines
    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;${startStyle}${endStyle}strokeWidth=1;`;
    
    // Calculate connection points based on relative positions
    let exitX = 0.5, exitY = 1, entryX = 0.5, entryY = 0;
    
    const sourceCenterX = sourcePos.x + sourcePos.width / 2;
    const sourceCenterY = sourcePos.y + sourcePos.height / 2;
    const targetCenterX = targetPos.x + targetPos.width / 2;
    const targetCenterY = targetPos.y + targetPos.height / 2;
    
    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;
    
    // Determine best exit/entry points based on relative position
    if (Math.abs(dy) > Math.abs(dx) * 0.5) {
      // Primarily vertical - connect top/bottom
      if (dy > 0) {
        exitX = 0.5; exitY = 1;  // Exit bottom
        entryX = 0.5; entryY = 0; // Enter top
      } else {
        exitX = 0.5; exitY = 0;  // Exit top
        entryX = 0.5; entryY = 1; // Enter bottom
      }
    } else {
      // Primarily horizontal - connect left/right
      if (dx > 0) {
        exitX = 1; exitY = 0.5;  // Exit right
        entryX = 0; entryY = 0.5; // Enter left
      } else {
        exitX = 0; exitY = 0.5;  // Exit left
        entryX = 1; entryY = 0.5; // Enter right
      }
    }
    
    // Calculate label offset to avoid overlapping
    // Different offsets for different relationship indices
    const labelOffsets = [
      { x: -20, y: -15 },
      { x: 20, y: -15 },
      { x: -20, y: 15 },
      { x: 20, y: 15 },
    ];
    const offset = labelOffsets[index % labelOffsets.length];
    
    return `        <mxCell id="rel_${index}" value="${label}" style="${edgeStyle}exitX=${exitX};exitY=${exitY};exitDx=0;exitDy=0;entryX=${entryX};entryY=${entryY};entryDx=0;entryDy=0;" edge="1" parent="1" source="${rel.source}" target="${rel.target}">
          <mxGeometry relative="1" as="geometry">
            <mxPoint as="offset" x="${offset.x}" y="${offset.y}"/>
          </mxGeometry>
        </mxCell>`;
  }).filter(Boolean).join('\n');
  
  // Calculate canvas size
  let maxX = 850, maxY = 600;
  positions.forEach((pos) => {
    maxX = Math.max(maxX, pos.x + pos.width + 100);
    maxY = Math.max(maxY, pos.y + pos.height + 100);
  });
  
  // Assemble final XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="BMAD-CLI-ER" version="21.0.0">
  <diagram name="${escapeXml(name)}" id="${diagramId}">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${Math.max(1100, maxX)}" pageHeight="${Math.max(850, maxY)}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${entitiesXml}
${relationshipsXml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  
  return xml;
}

/**
 * Check if a parsed diagram is an ER diagram
 */
function isERDiagram(parsedDiagram) {
  return parsedDiagram.type === 'erDiagram';
}

module.exports = {
  convertERToDrawio,
  isERDiagram,
  escapeXml,
  getCardinalityStyle,
  calculateERPositions,
};
