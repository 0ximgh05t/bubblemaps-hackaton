const { createCanvas } = require('canvas');
const createGraph = require('ngraph.graph');
const createLayout = require('ngraph.forcelayout');

class BubbleMapVisualizer {
  constructor() {
    this.width = 1200;
    this.height = 800;
    this.padding = 40;
    this.positions = new Map();
    // Updated colors to match the screenshot
    this.nodeColors = {
      cluster1: { fill: '#FF6B6B', border: '#FF6B6B', fillOpacity: 0.4, borderOpacity: 0.8 }, // Red cluster
      cluster2: { fill: '#4ECDC4', border: '#4ECDC4', fillOpacity: 0.4, borderOpacity: 0.8 }, // Teal cluster
      cluster3: { fill: '#45B7D1', border: '#45B7D1', fillOpacity: 0.4, borderOpacity: 0.8 }, // Blue cluster
      cluster4: { fill: '#96CEB4', border: '#96CEB4', fillOpacity: 0.4, borderOpacity: 0.8 }, // Green cluster
      cluster5: { fill: '#FFEEAD', border: '#FFEEAD', fillOpacity: 0.4, borderOpacity: 0.8 }, // Yellow cluster
      normal: { fill: '#4B3274', border: '#6A4A9E', fillOpacity: 0.6, borderOpacity: 0.6 }, // Default purple
      contract: { fill: '#4B3274', border: '#6A4A9E', opacity: 0.8 }, // Contract nodes
      whale: { fill: '#4B3274', border: '#6A4A9E', fillOpacity: 0.8, borderOpacity: 0.8 }, // Whale nodes
      dead: { fill: '#2B0E0E', border: '#8B0000', fillOpacity: 0.5, borderOpacity: 0.5 } // Dead nodes
    };
  }

  async generateImage(mapData) {
    if (!mapData || !mapData.nodes || !mapData.links) {
      throw new Error('Invalid mapData: Missing nodes or links');
    }

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Dark background to match the screenshot
    ctx.fillStyle = '#0A0514';
    ctx.fillRect(0, 0, this.width, this.height);

    const graph = createGraph();

    // Filter out contract nodes and create node objects with proper indices
    const nodes = mapData.nodes
      .filter(node => !node.is_contract)
      .map((node, index) => ({
        ...node,
        id: index,
        r: Math.max(Math.sqrt(node.percentage || 0) * 50, 8),
        cluster: null
      }));

    // Create a map of original indices to new indices
    const indexMap = new Map();
    nodes.forEach((node, newIndex) => {
      indexMap.set(node.id, newIndex);
    });

    const clusters = new Map();
    let clusterIndex = 0;
    const getOrCreateCluster = (nodeId) => {
      for (const [clusterId, members] of clusters.entries()) {
        if (members.has(nodeId)) return clusterId;
      }
      return null;
    };

    // Process links with validation
    mapData.links.forEach(link => {
      // Skip invalid links
      if (!Number.isFinite(link.source) || !Number.isFinite(link.target)) return;
      
      // Get the new indices for source and target
      const sourceIndex = indexMap.get(link.source);
      const targetIndex = indexMap.get(link.target);
      
      // Skip if either node doesn't exist in our filtered nodes
      if (sourceIndex === undefined || targetIndex === undefined) return;

      const sourceCluster = getOrCreateCluster(sourceIndex);
      const targetCluster = getOrCreateCluster(targetIndex);

      if (sourceCluster === null && targetCluster === null) {
        const newClusterId = clusterIndex++;
        clusters.set(newClusterId, new Set([sourceIndex, targetIndex]));
        nodes[sourceIndex].cluster = newClusterId;
        nodes[targetIndex].cluster = newClusterId;
      } else if (sourceCluster === null) {
        clusters.get(targetCluster).add(sourceIndex);
        nodes[sourceIndex].cluster = targetCluster;
      } else if (targetCluster === null) {
        clusters.get(sourceCluster).add(targetIndex);
        nodes[targetIndex].cluster = targetCluster;
      } else if (sourceCluster !== targetCluster) {
        const sourceMembers = clusters.get(sourceCluster);
        const targetMembers = clusters.get(targetCluster);
        sourceMembers.forEach(id => {
          targetMembers.add(id);
          nodes[id].cluster = targetCluster;
        });
        clusters.delete(sourceCluster);
      }
    });

    // Add nodes to graph with their data
    nodes.forEach(node => {
      graph.addNode(node.id, {
        ...node,
        r: node.r,
        cluster: node.cluster,
        percentage: node.percentage,
        name: node.name
      });
    });

    // Add links to graph
    mapData.links.forEach(link => {
      if (!Number.isFinite(link.source) || !Number.isFinite(link.target)) return;
      const sourceIndex = indexMap.get(link.source);
      const targetIndex = indexMap.get(link.target);
      if (sourceIndex !== undefined && targetIndex !== undefined) {
        graph.addLink(sourceIndex, targetIndex, {
          forward: link.forward || 0,
          backward: link.backward || 0
        });
      }
    });

    const layout = createLayout(graph, {
      springLength: 80, // Reduced for tighter clustering
      springCoefficient: 0.0008, // Increased for stronger connections
      gravity: -20, // Stronger gravity for more centralized layout
      dragCoefficient: 0.1,
      theta: 0.8
    });

    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const baseSpread = Math.min(this.width, this.height) * 0.4; // Reduced spread for tighter clustering
    const totalNodes = nodes.length;

    // Place nodes with larger percentages closer to center
    nodes.forEach((node, i) => {
      const percentage = node.percentage || 0;
      const distanceFromCenter = (1 - Math.min(1, percentage / 100)) * baseSpread;
      const angle = (i / totalNodes) * 2 * Math.PI;
      
      layout.setNodePosition(
        node.id,
        centerX + distanceFromCenter * Math.cos(angle),
        centerY + distanceFromCenter * Math.sin(angle)
      );
    });

    // Run layout algorithm with more iterations for better positioning
    for (let i = 0; i < 3000; i++) {
      layout.step();
    }

    // Adjust cluster positions to be closer together
    const clusterPositions = new Map();
    graph.forEachNode(node => {
      if (node.data && node.data.cluster !== null) {
        const pos = layout.getNodePosition(node.id);
        if (!clusterPositions.has(node.data.cluster)) {
          clusterPositions.set(node.data.cluster, { x: 0, y: 0, count: 0 });
        }
        const clusterPos = clusterPositions.get(node.data.cluster);
        clusterPos.x += pos.x;
        clusterPos.y += pos.y;
        clusterPos.count += 1;
      }
    });

    // Calculate cluster centers
    clusterPositions.forEach((pos, clusterId) => {
      pos.x /= pos.count;
      pos.y /= pos.count;
    });

    // Move nodes closer to their cluster centers
    graph.forEachNode(node => {
      if (node.data && node.data.cluster !== null) {
        const pos = layout.getNodePosition(node.id);
        const clusterCenter = clusterPositions.get(node.data.cluster);
        const dx = clusterCenter.x - pos.x;
        const dy = clusterCenter.y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const moveFactor = 0.3; // How much to move towards cluster center
        
        layout.setNodePosition(
          node.id,
          pos.x + dx * moveFactor,
          pos.y + dy * moveFactor
        );
      }
    });

    // Run final layout iterations
    for (let i = 0; i < 1000; i++) {
      layout.step();
    }

    this.positions.clear();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    graph.forEachNode(node => {
      const pos = layout.getNodePosition(node.id);
      const r = node.data.r;
      minX = Math.min(minX, pos.x - r);
      maxX = Math.max(maxX, pos.x + r);
      minY = Math.min(minY, pos.y - r);
      maxY = Math.max(maxY, pos.y + r);
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const scaleX = (this.width - this.padding * 2) / width;
    const scaleY = (this.height - this.padding * 2) / height;
    const scale = Math.min(scaleX, scaleY);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const offsetX = (this.width - scaledWidth) / 2;
    const offsetY = (this.height - scaledHeight) / 2;

    graph.forEachNode(node => {
      const pos = layout.getNodePosition(node.id);
      const x = (pos.x - minX) * scale + offsetX;
      const y = (pos.y - minY) * scale + offsetY;
      this.positions.set(node.id, { x, y, r: node.data.r * scale * 0.9 });
    });

    // Draw links (arrows) first to ensure they appear behind nodes
    ctx.lineWidth = 1.5; // Thinner arrows to match the screenshot
    graph.forEachLink(link => {
      const sourcePos = this.positions.get(link.fromId);
      const targetPos = this.positions.get(link.toId);
      if (!sourcePos || !targetPos) return;
      const totalValue = (link.data.forward || 0) + (link.data.backward || 0);
      const maxValue = Math.max(...mapData.links.map(l => (l.forward || 0) + (l.backward || 0))) || 1;
      const opacity = Math.max(0.3, Math.min(0.7, totalValue / maxValue)); // Adjusted opacity range

      if (link.data.forward > 0 && link.data.backward === 0) {
        this.drawArrow(ctx, link.fromId, link.toId, '#FFFFFF', opacity);
      } else if (link.data.backward > 0 && link.data.forward === 0) {
        this.drawArrow(ctx, link.toId, link.fromId, '#FFFFFF', opacity);
      } else if (link.data.forward > 0 && link.data.backward > 0) {
        this.drawArrow(ctx, link.fromId, link.toId, '#FFFFFF', opacity, 1.5);
        this.drawArrow(ctx, link.toId, link.fromId, '#FFFFFF', opacity, -1.5);
      }
    });

    // Draw nodes
    graph.forEachNode(node => {
      const pos = this.positions.get(node.id);
      const nodeData = node.data;
      let colors;
      
      // Safely handle undefined node names
      const nodeName = (nodeData.name || '').toLowerCase();
      
      if (nodeName.includes('null') || nodeName.includes('dead')) {
        colors = this.nodeColors.dead;
      } else if (nodeData.cluster !== null) {
        // Assign different colors based on cluster
        const clusterColors = [
          this.nodeColors.cluster1,
          this.nodeColors.cluster2,
          this.nodeColors.cluster3,
          this.nodeColors.cluster4,
          this.nodeColors.cluster5
        ];
        colors = clusterColors[nodeData.cluster % clusterColors.length];
      } else if (nodeData.percentage >= 5) {
        colors = this.nodeColors.whale;
      } else {
        colors = this.nodeColors.normal;
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pos.r, 0, 2 * Math.PI);
      ctx.fillStyle = `${colors.fill}${Math.round(colors.fillOpacity * 255).toString(16).padStart(2, '0')}`;
      ctx.fill();
      ctx.strokeStyle = `${colors.border}${Math.round(colors.borderOpacity * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 1.5; // Slightly thicker border for better visibility
      ctx.stroke();

      if (nodeData.percentage > 5) {
        ctx.shadowColor = colors.border;
        ctx.shadowBlur = 15; // Increased glow effect for important nodes
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });

    return canvas.toBuffer('image/png');
  }

  drawArrow(ctx, fromId, toId, color, opacity, offset = 0) {
    const from = this.positions.get(fromId);
    const to = this.positions.get(toId);
    if (!from || !to) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    const headLength = 8; // Smaller arrowhead to match the screenshot
    const startX = from.x + Math.cos(angle) * (from.r + 1);
    const startY = from.y + Math.sin(angle) * (from.r + 1);
    const endX = to.x - Math.cos(angle) * (to.r + headLength);
    const endY = to.y - Math.sin(angle) * (to.r + headLength);
    const offsetAngle = angle + Math.PI / 2;
    const offsetX = offset * Math.cos(offsetAngle);
    const offsetY = offset * Math.sin(offsetAngle);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
    ctx.beginPath();
    ctx.moveTo(startX + offsetX, startY + offsetY);
    ctx.lineTo(endX + offsetX, endY + offsetY);
    ctx.stroke();

    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(endX + offsetX, endY + offsetY);
    ctx.lineTo(endX + offsetX - headLength * Math.cos(angle - Math.PI / 8), endY + offsetY - headLength * Math.sin(angle - Math.PI / 8));
    ctx.lineTo(endX + offsetX - headLength * Math.cos(angle + Math.PI / 8), endY + offsetY - headLength * Math.sin(angle + Math.PI / 8));
    ctx.closePath();
    ctx.fill();
  }

  adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}

module.exports = new BubbleMapVisualizer();