// State Management
const state = {
    currentTool: 'pen',
    color: '#000000',
    brushSize: 5,
    opacity: 1,
    isDrawing: false,
    hasImage: false,
    recentColors: []
};

// DOM Elements
const lineCanvas = document.getElementById('lineCanvas');
const colorCanvas = document.getElementById('colorCanvas');
const lineCtx = lineCanvas.getContext('2d');
const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });

const imageInput = document.getElementById('imageInput');
const uploadOverlay = document.getElementById('uploadOverlay');
const penTool = document.getElementById('penTool');
const fillTool = document.getElementById('fillTool');
const brushSize = document.getElementById('brushSize');
const sizeValue = document.getElementById('sizeValue');
const opacity = document.getElementById('opacity');
const opacityValue = document.getElementById('opacityValue');
const colorPalette = document.getElementById('colorPalette');
const customColor = document.getElementById('customColor');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Initialize
function init() {
    setupEventListeners();
}

function setupEventListeners() {
    penTool.addEventListener('click', () => setTool('pen'));
    fillTool.addEventListener('click', () => setTool('fill'));

    brushSize.addEventListener('input', (e) => {
        state.brushSize = e.target.value;
        sizeValue.textContent = e.target.value;
    });

    opacity.addEventListener('input', (e) => {
        state.opacity = e.target.value / 100;
        opacityValue.textContent = e.target.value;
    });

    colorPalette.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-swatch')) {
            const color = e.target.dataset.color;
            setColor(color);
            customColor.value = color;
        }
    });

    // Recent Colors Click
    document.getElementById('recentColors').addEventListener('click', (e) => {
        if (e.target.classList.contains('color-swatch')) {
            const color = e.target.dataset.color;
            setColor(color, false); // Don't add to history again if clicked from history
            customColor.value = color;
        }
    });

    customColor.addEventListener('input', (e) => setColor(e.target.value));
    imageInput.addEventListener('change', handleImageUpload);

    // Mouse events on the container or color canvas
    // Since lineCanvas is pointer-events: none, events fall through to colorCanvas
    colorCanvas.addEventListener('mousedown', startDrawing);
    window.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    clearBtn.addEventListener('click', clearCanvas);
    downloadBtn.addEventListener('click', downloadArt);

    // Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const iconName = sidebar.classList.contains('collapsed') ? 'chevron-right' : 'chevron-left';
        sidebarToggle.innerHTML = `<i data-lucide="${iconName}"></i>`;
        lucide.createIcons();
    });

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        themeToggle.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}"></i>`;
        lucide.createIcons();
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });

    // Load Theme Preference
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
        themeToggle.innerHTML = `<i data-lucide="moon"></i>`;
        lucide.createIcons();
    }
}

function setTool(tool) {
    state.currentTool = tool;
    penTool.classList.toggle('active', tool === 'pen');
    fillTool.classList.toggle('active', tool === 'fill');
    document.querySelector('.canvas-wrapper').className = 'canvas-wrapper ' + (tool === 'pen' ? 'cursor-pen' : 'cursor-fill');
    
    // Update header status
    const activeToolIcon = document.getElementById('activeToolIcon');
    const iconName = tool === 'pen' ? 'pen-tool' : 'paint-bucket';
    activeToolIcon.innerHTML = `<i data-lucide="${iconName}"></i>`;
    lucide.createIcons();
}

function setColor(color, addToHistory = true) {
    state.color = color;
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.color === color);
    });
    
    // Update header status
    document.getElementById('activeColorIndicator').style.backgroundColor = color;

    if (addToHistory) {
        updateRecentColors(color);
    }
}

function updateRecentColors(color) {
    // Remove if already exists to move to front
    state.recentColors = state.recentColors.filter(c => c !== color);
    // Add to front
    state.recentColors.unshift(color);
    // Keep only 5
    if (state.recentColors.length > 5) {
        state.recentColors.pop();
    }
    
    renderRecentColors();
}

function renderRecentColors() {
    const container = document.getElementById('recentColors');
    if (state.recentColors.length === 0) {
        container.innerHTML = '<span style="font-size: 0.7rem; color: var(--text-secondary); opacity: 0.5;">No history</span>';
        return;
    }

    container.innerHTML = state.recentColors.map(color => `
        <div class="color-swatch ${color === state.color ? 'active' : ''}" 
             style="background: ${color};" 
             data-color="${color}"></div>
    `).join('');
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => processImage(img);
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function processImage(img) {
    const container = document.getElementById('container');
    const maxWidth = container.clientWidth * 0.9;
    const maxHeight = container.clientHeight * 0.9;
    
    let width = img.width;
    let height = img.height;
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width *= ratio;
    height *= ratio;

    // Set both canvases to same size
    [lineCanvas, colorCanvas].forEach(c => {
        c.width = width;
        c.height = height;
    });

    // Clear color canvas with white
    colorCtx.fillStyle = 'white';
    colorCtx.fillRect(0, 0, width, height);
    
    // Process lines
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, width, height);
    
    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // If it's light, make it transparent
        // If it's dark, make it pure black
        if (gray > 120) {
            data[i + 3] = 0; // Transparent
        } else {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 255; // Opaque Black
        }
    }

    lineCtx.putImageData(imageData, 0, 0);
    
    uploadOverlay.classList.add('hidden');
    state.hasImage = true;
    setTool('pen');
}

let lastX = 0;
let lastY = 0;

function startDrawing(e) {
    if (!state.hasImage) return;
    const { x, y } = getMousePos(e);
    
    if (state.currentTool === 'fill') {
        floodFill(Math.round(x), Math.round(y), state.color);
        return;
    }
    
    state.isDrawing = true;
    [lastX, lastY] = [x, y];
}

function draw(e) {
    if (!state.isDrawing) return;
    const { x, y } = getMousePos(e);
    
    colorCtx.beginPath();
    colorCtx.moveTo(lastX, lastY);
    colorCtx.lineTo(x, y);
    colorCtx.strokeStyle = state.color;
    colorCtx.lineWidth = state.brushSize;
    colorCtx.lineCap = 'round';
    colorCtx.lineJoin = 'round';
    colorCtx.globalAlpha = state.opacity;
    colorCtx.stroke();
    
    [lastX, lastY] = [x, y];
}

function stopDrawing() {
    state.isDrawing = false;
    colorCtx.globalAlpha = 1.0;
}

function getMousePos(e) {
    const rect = colorCanvas.getBoundingClientRect();
    const scaleX = colorCanvas.width / rect.width;
    const scaleY = colorCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function floodFill(startX, startY, fillColor) {
    // We fill on the colorCanvas but we need to know where the boundaries are on the lineCanvas
    // Actually, for a coloring book, we fill on the colorCanvas based on what's already there
    // BUT we also need to consider the lines.
    
    // Simplest robust way: 
    // 1. Get pixel data from BOTH canvases
    // 2. Treat black pixels on lineCanvas as boundaries
    
    const lineData = lineCtx.getImageData(0, 0, lineCanvas.width, lineCanvas.height).data;
    const colorImageData = colorCtx.getImageData(0, 0, colorCanvas.width, colorCanvas.height);
    const colorData = colorImageData.data;
    
    const targetPos = (startY * colorCanvas.width + startX) * 4;
    const targetR = colorData[targetPos], targetG = colorData[targetPos + 1], targetB = colorData[targetPos + 2];
    
    const fillR = parseInt(fillColor.substr(1, 2), 16);
    const fillG = parseInt(fillColor.substr(3, 2), 16);
    const fillB = parseInt(fillColor.substr(5, 2), 16);
    
    if (targetR === fillR && targetG === fillG && targetB === fillB) return;

    const stack = [[startX, startY]];
    const width = colorCanvas.width;
    const height = colorCanvas.height;

    while (stack.length > 0) {
        const [x, y] = stack.pop();
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        
        const pos = (y * width + x) * 4;
        
        // Boundary conditions:
        // 1. Color matches target color on colorCanvas
        // 2. Not a black line on lineCanvas
        const isBlackLine = lineData[pos + 3] > 100; // Opaque enough to be a line
        
        if (!isBlackLine && 
            colorData[pos] === targetR && 
            colorData[pos + 1] === targetG && 
            colorData[pos + 2] === targetB) {
            
            colorData[pos] = fillR;
            colorData[pos + 1] = fillG;
            colorData[pos + 2] = fillB;
            colorData[pos + 3] = 255;
            
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }
    
    colorCtx.putImageData(colorImageData, 0, 0);
}

function clearCanvas() {
    if (confirm('Are you sure you want to clear your artwork?')) {
        colorCtx.fillStyle = 'white';
        colorCtx.fillRect(0, 0, colorCanvas.width, colorCanvas.height);
    }
}

function downloadArt() {
    if (!state.hasImage) return;
    
    // Merge canvases for download
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = colorCanvas.width;
    finalCanvas.height = colorCanvas.height;
    const finalCtx = finalCanvas.getContext('2d');
    
    finalCtx.drawImage(colorCanvas, 0, 0);
    finalCtx.drawImage(lineCanvas, 0, 0);
    
    const link = document.createElement('a');
    link.download = 'chromasketch-art.png';
    link.href = finalCanvas.toDataURL();
    link.click();
}

init();
