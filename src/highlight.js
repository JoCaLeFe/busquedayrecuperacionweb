// ast-renderer.js
const canvas = document.getElementById('astCanvas');
const ctx = canvas.getContext('2d');

// Constants for styles
const NODE_RADIUS = 30;
const VERTICAL_SPACING = 100;
const HORIZONTAL_SPACING = 125;
const CANVAS_BACKGROUND_COLOR = '#121212';
const NODE_FILL_COLOR = '#1e1e1e';
const NODE_STROKE_COLOR = '#333333';
const EDGE_COLOR = '#333333';
const NODE_TEXT_COLOR = '#ffffff';
const NODE_FONT = '12px Inter, Arial, sans-serif';
const LABEL_COLOR = '#b3b3b3';
const LABEL_FONT = '10px Inter, Arial, sans-serif';
const LINE_WIDTH = 3;

function drawNode(x, y, label) {
    ctx.lineWidth = LINE_WIDTH;

    ctx.beginPath();
    ctx.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = NODE_FILL_COLOR;
    ctx.fill();
    ctx.strokeStyle = NODE_STROKE_COLOR;
    ctx.stroke();

    ctx.fillStyle = NODE_TEXT_COLOR;
    ctx.font = NODE_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
}

function drawEdge(x1, y1, x2, y2) {
    ctx.lineWidth = LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x1, y1 + NODE_RADIUS);
    ctx.lineTo(x2, y2 - NODE_RADIUS);
    ctx.strokeStyle = EDGE_COLOR;
    ctx.stroke();
}

function drawLabel(x, y, label) {
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
}

function calculateTreeDimensions(node) {
    if (node.type === 'leaf') {
        return { width: HORIZONTAL_SPACING, height: VERTICAL_SPACING };
    }

    let totalWidth = 0;
    let maxHeight = 0;

    for (let child of node.children) {
        const childDim = calculateTreeDimensions(child.node);
        totalWidth += childDim.width;
        maxHeight = Math.max(maxHeight, childDim.height);
    }

    return { width: Math.max(totalWidth, HORIZONTAL_SPACING), height: maxHeight + VERTICAL_SPACING };
}

function drawTree(node, x, y, parentX, parentY, label) {
    if (parentX !== undefined && parentY !== undefined) {
        drawEdge(parentX, parentY, x, y);
    }

    drawNode(x, y, node.value);

    if (label) {
        drawLabel(x, y - NODE_RADIUS - 20, label);
    }

    if (node.type === 'leaf') return;

    const dimensions = node.children.map(child => calculateTreeDimensions(child.node));
    const totalWidth = dimensions.reduce((sum, dim) => sum + dim.width, 0);
    let startX = x - totalWidth / 2;

    for (let i = 0; i < node.children.length; i++) {
        const childWidth = dimensions[i].width;
        const childX = startX + childWidth / 2;
        drawTree(node.children[i].node, childX, y + VERTICAL_SPACING, x, y, node.children[i].label);
        startX += childWidth;
    }
}

function renderAST() {
    if (!astData) return;

    const treeDimensions = calculateTreeDimensions(astData);
    canvas.width = treeDimensions.width;
    canvas.height = treeDimensions.height;

    ctx.fillStyle = CANVAS_BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawTree(astData, canvas.width / 2, NODE_RADIUS + 10);
}

window.onload = renderAST;
