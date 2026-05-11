// State Management
const state = {
    currentTool: 'pen',
    color: '#000000',
    brushSize: 5,
    opacity: 1,
    isDrawing: false,
    hasImage: false,
    recentColors: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    pointers: new Map() // For multi-touch tracking
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
const canvasWrapper = document.getElementById('canvasWrapper');
const zoomIndicator = document.getElementById('zoomIndicator');
const fullscreenToggle = document.getElementById('fullscreenToggle');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const resetViewBtn = document.getElementById('resetView');
const newImageBtn = document.getElementById('newImageBtn');

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

    // Zoom/Pan/Draw Event Listeners
    canvasWrapper.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    canvasWrapper.addEventListener('wheel', handleWheel, { passive: false });
    
    // Prevent common iPad gestures that might interfere
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    // Prevent context menu (Save Image popup) on the canvas
    canvasWrapper.addEventListener('contextmenu', (e) => e.preventDefault());

    // New Controls
    zoomInBtn.addEventListener('click', () => adjustZoom(0.2));
    zoomOutBtn.addEventListener('click', () => adjustZoom(-0.2));
    resetViewBtn.addEventListener('click', resetView);
    fullscreenToggle.addEventListener('click', toggleFullscreen);
    newImageBtn.addEventListener('click', () => imageInput.click());

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
        container.innerHTML = '';
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
    // Increase internal resolution for sharpness
    // We cap it at 4096px to prevent memory issues on lower-end devices
    const MAX_CANVAS_DIM = 4096;
    let width = img.width;
    let height = img.height;

    if (width > MAX_CANVAS_DIM || height > MAX_CANVAS_DIM) {
        const ratio = Math.min(MAX_CANVAS_DIM / width, MAX_CANVAS_DIM / height);
        width *= ratio;
        height *= ratio;
    }

    // Set both canvases to high-res internal size
    [lineCanvas, colorCanvas].forEach(c => {
        c.width = width;
        c.height = height;
        // Ensure CSS display size matches
        c.style.width = 'auto';
        c.style.height = 'auto';
    });

    // Clear color canvas with white
    colorCtx.fillStyle = 'white';
    colorCtx.fillRect(0, 0, width, height);
    
    // Process lines at high resolution
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, width, height);
    tempCtx.drawImage(img, 0, 0, width, height);
    
    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Use a slightly softer threshold or just pure black for coloring book
        // Increasing resolution makes even hard thresholds look much better
        if (gray > 140) { // Slightly higher threshold to capture more faint lines
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
    
    // Reset view will now correctly scale the high-res canvas to fit the screen
    resetView();
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

// Pointer Handling for Multi-touch (Pinch/Pan)
let lastPinchDist = 0;
let lastPinchMidpoint = { x: 0, y: 0 };

function handlePointerDown(e) {
    state.pointers.set(e.pointerId, e);
    
    if (state.pointers.size === 1 && state.hasImage) {
        // Support for Apple Pencil (pen) - can draw even if palm is near
        // If it's a pen, we might want to allow pressure-based effects later
        startDrawing(e);
    } else if (state.pointers.size === 2) {
        state.isDrawing = false; // Stop drawing if second finger added
        const pts = Array.from(state.pointers.values());
        lastPinchDist = getDistance(pts[0], pts[1]);
        lastPinchMidpoint = getMidpoint(pts[0], pts[1]);
    }
}

function handlePointerMove(e) {
    if (!state.pointers.has(e.pointerId)) return;
    state.pointers.set(e.pointerId, e);

    if (state.pointers.size === 1) {
        if (state.isDrawing) {
            draw(e);
        }
    } else if (state.pointers.size === 2) {
        const pts = Array.from(state.pointers.values());
        
        // 1. Zoom
        const dist = getDistance(pts[0], pts[1]);
        const zoomFactor = dist / lastPinchDist;
        const newZoom = Math.min(Math.max(state.zoom * zoomFactor, 0.5), 10);
        
        // 2. Pan
        const midpoint = getMidpoint(pts[0], pts[1]);
        const dx = midpoint.x - lastPinchMidpoint.x;
        const dy = midpoint.y - lastPinchMidpoint.y;
        
        state.panX += dx;
        state.panY += dy;
        state.zoom = newZoom;
        
        lastPinchDist = dist;
        lastPinchMidpoint = midpoint;
        updateTransform();
    }
}

function handlePointerUp(e) {
    state.pointers.delete(e.pointerId);
    if (state.pointers.size < 2) {
        lastPinchDist = 0;
    }
    if (state.pointers.size === 0) {
        stopDrawing();
    }
}

function handleWheel(e) {
    e.preventDefault();
    const zoomSpeed = 0.001;
    const delta = -e.deltaY;
    const factor = Math.pow(1.1, delta / 100);
    const newZoom = Math.min(Math.max(state.zoom * factor, 0.5), 10);
    
    // Zoom towards mouse position
    // (This is a bit more complex, for now let's just zoom center)
    state.zoom = newZoom;
    updateTransform();
}

function updateTransform() {
    canvasWrapper.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    zoomIndicator.textContent = `${Math.round(state.zoom * 100)}%`;
}

function adjustZoom(delta) {
    state.zoom = Math.min(Math.max(state.zoom + delta, 0.5), 10);
    updateTransform();
}

function fitToScreen() {
    if (!state.hasImage) return;
    
    const container = document.getElementById('container');
    const padding = 40; // Maintain a small margin
    
    const availableWidth = container.clientWidth - padding;
    const availableHeight = container.clientHeight - padding;
    
    // Calculate scale to fit current container
    const scale = Math.min(
        availableWidth / colorCanvas.width,
        availableHeight / colorCanvas.height
    );
    
    state.zoom = scale;
    state.panX = 0;
    state.panY = 0;
    updateTransform();
}

function resetView() {
    fitToScreen();
}

async function toggleFullscreen() {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
        try {
            await elem.requestFullscreen();
            fullscreenToggle.innerHTML = '<i data-lucide="minimize"></i>';
        } catch (err) {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        }
    } else {
        document.exitFullscreen();
        fullscreenToggle.innerHTML = '<i data-lucide="maximize"></i>';
    }
    lucide.createIcons();
}

// Utility functions
function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.clientX - p1.clientX, 2) + Math.pow(p2.clientY - p1.clientY, 2));
}

function getMidpoint(p1, p2) {
    return {
        x: (p1.clientX + p2.clientX) / 2,
        y: (p1.clientY + p2.clientY) / 2
    };
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
