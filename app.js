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
    pointers: new Map(), // For multi-touch tracking
    showReference: false,
    outlineFile: null,
    referenceFile: null
};

// DOM Elements
const lineCanvas = document.getElementById('lineCanvas');
const refCanvas = document.getElementById('refCanvas');
const colorCanvas = document.getElementById('colorCanvas');
const lineCtx = lineCanvas.getContext('2d');
const refCtx = refCanvas.getContext('2d');
const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });

const outlineInput = document.getElementById('outlineInput');
const referenceInput = document.getElementById('referenceInput');
const startColoringBtn = document.getElementById('startColoringBtn');
const blankCanvasBtn = document.getElementById('blankCanvasBtn');
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
const toggleReferenceBtn = document.getElementById('toggleReference');

// Initialize
function init() {
    setupEventListeners();
    updatePublishStatus();
}

async function updatePublishStatus() {
    const publishTimeEl = document.getElementById('publishTime');
    try {
        // Fetch local version.json stamped at deploy time
        const response = await fetch(`./version.json?_=${Date.now()}`); // cache-bust
        if (!response.ok) throw new Error('version.json not found');
        
        const data = await response.json();
        const buildTime = new Date(data.buildTime);
        const version = data.version || '?';
        
        function updateTimeAgo() {
            const now = new Date();
            const diffInSeconds = Math.floor((now - buildTime) / 1000);
            
            let timeAgo = '';
            if (diffInSeconds < 60) timeAgo = 'just now';
            else if (diffInSeconds < 3600) {
                const mins = Math.floor(diffInSeconds / 60);
                timeAgo = `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;
            } else if (diffInSeconds < 86400) {
                const hrs = Math.floor(diffInSeconds / 3600);
                timeAgo = `${hrs} ${hrs === 1 ? 'hr' : 'hrs'} ago`;
            } else {
                const days = Math.floor(diffInSeconds / 86400);
                timeAgo = `${days} ${days === 1 ? 'day' : 'days'} ago`;
            }
            
            publishTimeEl.textContent = `v${version} · ${timeAgo}`;
        }
        
        updateTimeAgo();
        setInterval(updateTimeAgo, 60000); // refresh display every minute
    } catch (error) {
        publishTimeEl.textContent = 'v1.0.0';
        console.warn('Could not read version.json:', error);
    }
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
    document.getElementById('recentColorsContainer').addEventListener('click', (e) => {
        if (e.target.classList.contains('color-swatch')) {
            const color = e.target.dataset.color;
            setColor(color, false); // Don't add to history again if clicked from history
            customColor.value = color;
            document.getElementById('moreRecentDropdown').classList.add('hidden');
        }
    });

    // More recent toggle
    document.getElementById('moreRecentBtn').addEventListener('click', () => {
        document.getElementById('moreRecentDropdown').classList.toggle('hidden');
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        const container = document.getElementById('recentColorsContainer');
        if (container && !container.contains(e.target)) {
            const dropdown = document.getElementById('moreRecentDropdown');
            if (dropdown && !dropdown.classList.contains('hidden')) {
                dropdown.classList.add('hidden');
            }
        }
    });

    customColor.addEventListener('input', (e) => setColor(e.target.value, false));
    customColor.addEventListener('change', (e) => updateRecentColors(e.target.value));
    
    outlineInput.addEventListener('change', (e) => handleFileSelection(e, 'outline'));
    referenceInput.addEventListener('change', (e) => handleFileSelection(e, 'reference'));
    startColoringBtn.addEventListener('click', startColoring);
    blankCanvasBtn.addEventListener('click', () => processImages(null, null));

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
        if (window.visualViewport && window.visualViewport.scale > 1.01) return;
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
        if (window.visualViewport && window.visualViewport.scale > 1.01) return;
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    
    // Prevent double-tap to zoom on iPad
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            // Only prevent if we're not tapping an input or label
            const tag = e.target.tagName.toLowerCase();
            if (tag !== 'input' && tag !== 'label') {
                e.preventDefault();
            }
        }
        lastTouchEnd = now;
    }, { passive: false });

    // Prevent context menu (Save Image popup) on the canvas
    canvasWrapper.addEventListener('contextmenu', (e) => e.preventDefault());

    // New Controls
    zoomInBtn.addEventListener('click', () => adjustZoom(0.2));
    zoomOutBtn.addEventListener('click', () => adjustZoom(-0.2));
    resetViewBtn.addEventListener('click', resetView);
    toggleReferenceBtn.addEventListener('click', toggleReference);
    fullscreenToggle.addEventListener('click', toggleFullscreen);
    newImageBtn.addEventListener('click', () => {
        uploadOverlay.classList.remove('hidden');
        state.hasImage = false;
        state.outlineFile = null;
        state.referenceFile = null;
        updateUploadUI();
    });

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

    // Viewport Zoom Escape Hatch
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
}

function handleViewportChange() {
    const overlay = document.getElementById('zoomWarningOverlay');
    if (!overlay) return;
    
    if (window.visualViewport.scale > 1.01) {
        overlay.style.display = 'flex';
    } else {
        overlay.style.display = 'none';
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
    // Keep up to 15 colors
    if (state.recentColors.length > 15) {
        state.recentColors.pop();
    }
    
    renderRecentColors();
}

function renderRecentColors() {
    const container = document.getElementById('recentColors');
    const dropdown = document.getElementById('moreRecentDropdown');
    const moreBtn = document.getElementById('moreRecentBtn');
    
    if (state.recentColors.length === 0) {
        container.innerHTML = '';
        moreBtn.style.display = 'none';
        return;
    }

    const top3 = state.recentColors.slice(0, 3);
    const rest = state.recentColors.slice(3);

    container.innerHTML = top3.map(color => `
        <div class="color-swatch ${color === state.color ? 'active' : ''}" 
             style="background: ${color};" 
             data-color="${color}"></div>
    `).join('');

    if (rest.length > 0) {
        moreBtn.style.display = 'flex';
        dropdown.innerHTML = rest.map(color => `
            <div class="color-swatch ${color === state.color ? 'active' : ''}" 
                 style="background: ${color};" 
                 data-color="${color}"></div>
        `).join('');
    } else {
        moreBtn.style.display = 'none';
        dropdown.innerHTML = '';
        dropdown.classList.add('hidden');
    }
}

function handleFileSelection(e, type) {
    const file = e.target.files[0];
    if (!file) return;

    if (type === 'outline') {
        state.outlineFile = file;
        document.getElementById('outlineName').textContent = file.name;
    } else {
        state.referenceFile = file;
        document.getElementById('referenceName').textContent = file.name;
    }
    updateUploadUI();
}

function updateUploadUI() {
    const startBtn = document.getElementById('startColoringBtn');
    startBtn.disabled = !state.outlineFile;
    
    // Clear display if starting new
    if (!state.outlineFile) {
        document.getElementById('outlineName').textContent = 'No file selected';
        document.getElementById('referenceName').textContent = 'No file selected';
    }
}

async function startColoring() {
    if (!state.outlineFile) return;

    const outlineImg = await loadImage(state.outlineFile);
    let referenceImg = null;
    if (state.referenceFile) {
        referenceImg = await loadImage(state.referenceFile);
    }

    processImages(outlineImg, referenceImg);
}

function loadImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function processImages(outlineImg, referenceImg) {
    // Keep internal canvas resolution at full image size (up to 8K)
    const MAX_CANVAS_DIM = 8192;
    let width, height;
    
    if (outlineImg) {
        width = outlineImg.width;
        height = outlineImg.height;
    } else {
        // Blank canvas: use container size
        const container = document.getElementById('container');
        const padding = 60;
        width = Math.max(800, container.clientWidth - padding);
        height = Math.max(600, container.clientHeight - padding);
    }

    if (width > MAX_CANVAS_DIM || height > MAX_CANVAS_DIM) {
        const ratio = Math.min(MAX_CANVAS_DIM / width, MAX_CANVAS_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    // Calculate a CSS display size that fits within the viewport
    const container = document.getElementById('container');
    const padding = 60;
    const availableWidth = container.clientWidth - padding;
    const availableHeight = container.clientHeight - padding;
    const displayScale = Math.min(availableWidth / width, availableHeight / height, 1);
    const displayWidth = Math.round(width * displayScale);
    const displayHeight = Math.round(height * displayScale);

    // Set internal (pixel) resolution on all canvases
    [lineCanvas, colorCanvas, refCanvas].forEach(c => {
        c.width = width;
        c.height = height;
        c.style.width = displayWidth + 'px';
        c.style.height = displayHeight + 'px';
    });

    // Set the wrapper size to match the visual display size
    canvasWrapper.style.width = displayWidth + 'px';
    canvasWrapper.style.height = displayHeight + 'px';

    // Reset transform
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    updateTransform();

    // Clear color canvas with white
    colorCtx.fillStyle = 'white';
    colorCtx.fillRect(0, 0, width, height);
    
    // Clear ref canvas
    refCtx.clearRect(0, 0, width, height);
    
    if (outlineImg) {
        // Process outline lines
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, width, height);
        tempCtx.drawImage(outlineImg, 0, 0, width, height);
        
        const imageData = tempCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            
            if (gray > 140) {
                data[i + 3] = 0; // Transparent
            } else {
                data[i] = 0;
                data[i + 1] = 0;
                data[i + 2] = 0;
                data[i + 3] = 255; // Opaque Black
            }
        }
        lineCtx.putImageData(imageData, 0, 0);
    } else {
        // Blank canvas: clear line layer entirely
        lineCtx.clearRect(0, 0, width, height);
    }

    // Process reference image if available
    if (referenceImg) {
        refCtx.drawImage(referenceImg, 0, 0, width, height);
        toggleReferenceBtn.style.display = 'flex';
    } else {
        toggleReferenceBtn.style.display = 'none';
    }
    
    uploadOverlay.classList.add('hidden');
    state.hasImage = true;
    state.showReference = false;
    updateReferenceVisibility();
    setTool('pen');
}

function toggleReference() {
    state.showReference = !state.showReference;
    updateReferenceVisibility();
}

function updateReferenceVisibility() {
    refCanvas.style.opacity = state.showReference ? '1' : '0';
    toggleReferenceBtn.classList.toggle('active', state.showReference);
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
    // The canvas CSS display size is already set to fit the screen on load.
    // So "fit to screen" just means reset zoom=1 and pan=0.
    state.zoom = 1;
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
