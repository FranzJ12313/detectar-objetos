// Variables globales
let records = [];
let stream = null;
let cameraActive = false;
let model = null;
let modelReady = false;
let currentAnalysis = null;

// Elementos DOM
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadBtnText = document.getElementById('uploadBtnText');
const video = document.getElementById('video');
const captureBtn = document.getElementById('captureBtn');
const toggleCamera = document.getElementById('toggleCamera');
const canvas = document.getElementById('canvas');
const tempCanvas = document.getElementById('tempCanvas');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const progressFill = document.getElementById('progressFill');
const recordsGrid = document.getElementById('recordsGrid');
const recordCount = document.getElementById('recordCount');
const clearAll = document.getElementById('clearAll');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const modelStatus = document.getElementById('modelStatus');

// Modal
const analysisModal = document.getElementById('analysisModal');
const closeModal = document.getElementById('closeModal');
const discardBtn = document.getElementById('discardBtn');
const saveBtn = document.getElementById('saveBtn');
const analyzedImage = document.getElementById('analyzedImage');
const detectionsList = document.getElementById('detectionsList');
const colorBox = document.getElementById('colorBox');
const colorName = document.getElementById('colorName');
const colorHex = document.getElementById('colorHex');
const colorRgb = document.getElementById('colorRgb');
const shapeIcon = document.getElementById('shapeIcon');
const shapeName = document.getElementById('shapeName');
const analysisDate = document.getElementById('analysisDate');
const analysisTime = document.getElementById('analysisTime');

// Cargar modelo COCO-SSD
async function loadModel() {
    try {
        modelStatus.textContent = '🔄 Cargando modelo YOLO...';
        
        model = await cocoSsd.load({
            base: 'lite_mobilenet_v2'
        });
        
        modelReady = true;
        modelStatus.textContent = '✅ Modelo listo';
        modelStatus.classList.add('ready');
        uploadBtn.disabled = false;
        uploadBtnText.textContent = 'Seleccionar Imagen';
        
        console.log('Modelo YOLO cargado exitosamente');
    } catch (error) {
        console.error('Error al cargar modelo:', error);
        modelStatus.textContent = '❌ Error al cargar modelo';
        alert('Error al cargar el modelo YOLO. Recarga la página.');
    }
}

loadModel();

// Tabs
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`${tabName}-content`).classList.add('active');
        if (tabName !== 'camera' && cameraActive) stopCamera();
    });
});

// Upload
uploadBtn.addEventListener('click', () => {
    if (modelReady) fileInput.click();
});

fileInput.addEventListener('change', handleFileUpload);

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !modelReady) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        await analyzeImage(event.target.result);
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
}

// Cámara
toggleCamera.addEventListener('click', () => {
    if (cameraActive) stopCamera();
    else startCamera();
});

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: 1280, height: 720 } 
        });
        video.srcObject = stream;
        cameraActive = true;
        toggleCamera.textContent = 'Detener Cámara';
        if (modelReady) captureBtn.disabled = false;
    } catch (err) {
        alert('Error al acceder a la cámara: ' + err.message);
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    video.srcObject = null;
    cameraActive = false;
    toggleCamera.textContent = 'Iniciar Cámara';
    captureBtn.disabled = true;
}

captureBtn.addEventListener('click', captureFromCamera);

async function captureFromCamera() {
    if (!cameraActive || !modelReady) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageSrc = canvas.toDataURL('image/jpeg', 0.85);
    await analyzeImage(imageSrc);
}

// ANÁLISIS ROBUSTO
async function analyzeImage(imageSrc) {
    if (!modelReady) {
        alert('El modelo aún no está listo.');
        return;
    }
    
    loading.classList.add('active');
    progressFill.style.width = '0%';
    
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
            try {
                // Paso 1: Preparar imagen
                loadingText.textContent = '📐 Preparando imagen...';
                progressFill.style.width = '20%';
                
                const ctx = canvas.getContext('2d');
                const maxSize = 640;
                let w = img.width;
                let h = img.height;
                
                if (w > maxSize || h > maxSize) {
                    const scale = maxSize / Math.max(w, h);
                    w = Math.floor(w * scale);
                    h = Math.floor(h * scale);
                }
                
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                
                await sleep(100);
                
                // Paso 2: Detección YOLO
                loadingText.textContent = '🤖 Detectando objetos con YOLO...';
                progressFill.style.width = '40%';
                
                const predictions = await model.detect(canvas, 10); // Hasta 10 objetos
                
                await sleep(100);
                
                // Paso 3: Análisis de color ROBUSTO
                loadingText.textContent = '🎨 Analizando colores...';
                progressFill.style.width = '60%';
                
                const imageData = ctx.getImageData(0, 0, w, h);
                const color = detectDominantColorRobust(imageData);
                
                await sleep(100);
                
                // Paso 4: Detección de forma
                loadingText.textContent = '📐 Detectando forma...';
                progressFill.style.width = '80%';
                
                const shape = determineShapeRobust(predictions, w, h, imageData);
                
                await sleep(100);
                
                // Paso 5: Dibujar detecciones
                loadingText.textContent = '✨ Finalizando...';
                progressFill.style.width = '100%';
                
                drawPredictions(ctx, predictions);
                const annotatedImage = canvas.toDataURL('image/jpeg', 0.9);
                
                await sleep(200);
                
                // Crear análisis
                const now = new Date();
                currentAnalysis = {
                    id: Date.now(),
                    image: annotatedImage,
                    originalImage: imageSrc,
                    color: color,
                    shape: shape,
                    detections: predictions.map(p => ({
                        class: translateClass(p.class),
                        confidence: (p.score * 100).toFixed(1),
                        bbox: p.bbox
                    })),
                    date: now.toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                    }),
                    time: now.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    })
                };
                
                loading.classList.remove('active');
                showAnalysisModal();
                resolve(currentAnalysis);
                
            } catch (error) {
                console.error('Error:', error);
                alert('Error al analizar la imagen');
                loading.classList.remove('active');
            }
        };
        img.onerror = () => {
            alert('Error al cargar la imagen');
            loading.classList.remove('active');
        };
        img.src = imageSrc;
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// DETECCIÓN DE COLOR ROBUSTA
function detectDominantColorRobust(imageData) {
    const data = imageData.data;
    const colorCounts = {};
    const totalPixels = data.length / 4;
    const sampleRate = 10; // Muestrear 1 de cada 10 píxeles
    
    // Contar colores con agrupación inteligente
    for (let i = 0; i < data.length; i += sampleRate * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // Ignorar píxeles transparentes
        if (a < 128) continue;
        
        // Agrupar en bins de 32 (más preciso que 51)
        const rBin = Math.floor(r / 32) * 32;
        const gBin = Math.floor(g / 32) * 32;
        const bBin = Math.floor(b / 32) * 32;
        
        const key = `${rBin},${gBin},${bBin}`;
        colorCounts[key] = (colorCounts[key] || 0) + 1;
    }
    
    // Encontrar color dominante
    let maxCount = 0;
    let dominantColor = '128,128,128';
    
    for (const [color, count] of Object.entries(colorCounts)) {
        if (count > maxCount) {
            maxCount = count;
            dominantColor = color;
        }
    }
    
    const [r, g, b] = dominantColor.split(',').map(Number);
    
    // Calcular valores promedio en la región del color dominante para mayor precisión
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (let i = 0; i < data.length; i += sampleRate * 4) {
        const pixelR = data[i];
        const pixelG = data[i + 1];
        const pixelB = data[i + 2];
        
        // Si está cerca del color dominante
        if (Math.abs(pixelR - r) < 40 && Math.abs(pixelG - g) < 40 && Math.abs(pixelB - b) < 40) {
            sumR += pixelR;
            sumG += pixelG;
            sumB += pixelB;
            count++;
        }
    }
    
    const avgR = count > 0 ? Math.round(sumR / count) : r;
    const avgG = count > 0 ? Math.round(sumG / count) : g;
    const avgB = count > 0 ? Math.round(sumB / count) : b;
    
    const hex = '#' + [avgR, avgG, avgB].map(x => x.toString(16).padStart(2, '0')).join('');
    const rgb = `rgb(${avgR}, ${avgG}, ${avgB})`;
    const name = getColorNameRobust(avgR, avgG, avgB);
    
    return { rgb, hex, name, r: avgR, g: avgG, b: avgB };
}

// DETECCIÓN DE FORMA ROBUSTA
function determineShapeRobust(predictions, width, height, imageData) {
    // Si YOLO detectó objetos, usar esa información
    if (predictions.length > 0) {
        // Analizar el objeto más grande
        const largest = predictions.reduce((max, p) => {
            const area = p.bbox[2] * p.bbox[3];
            const maxArea = max.bbox[2] * max.bbox[3];
            return area > maxArea ? p : max;
        });
        
        const [x, y, w, h] = largest.bbox;
        const aspectRatio = w / h;
        
        // Objetos claramente circulares
        const roundObjects = ['sports ball', 'orange', 'apple', 'clock', 'frisbee', 'donut'];
        if (roundObjects.includes(largest.class)) {
            return 'Círculo';
        }
        
        // Objetos rectangulares alargados
        const rectangularObjects = ['cell phone', 'remote', 'book', 'keyboard', 'laptop', 'tv'];
        if (rectangularObjects.includes(largest.class)) {
            return 'Rectángulo';
        }
        
        // Análisis por aspecto ratio
        if (aspectRatio >= 0.85 && aspectRatio <= 1.15) {
            // Podría ser cuadrado o círculo, analizar más
            return analyzeCircularity(imageData, largest.bbox) > 0.8 ? 'Círculo' : 'Cuadrado';
        } else if (aspectRatio > 1.5 || aspectRatio < 0.67) {
            return 'Rectángulo';
        }
    }
    
    // Si no hay detecciones, análisis básico
    const aspectRatio = width / height;
    if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
        return 'Cuadrado';
    }
    return 'Rectángulo';
}

// Analizar circularidad de un área
function analyzeCircularity(imageData, bbox) {
    const [x, y, w, h] = bbox.map(Math.floor);
    const data = imageData.data;
    const width = imageData.width;
    
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const radius = Math.min(w, h) / 2;
    
    let insideCircle = 0;
    let total = 0;
    
    // Muestrear puntos en el bbox
    for (let py = y; py < y + h; py += 3) {
        for (let px = x; px < x + w; px += 3) {
            if (px >= 0 && px < width && py >= 0 && py < imageData.height) {
                const idx = (py * width + px) * 4;
                const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                
                if (brightness > 50) { // Píxel significativo
                    total++;
                    const dist = Math.sqrt(Math.pow(px - centerX, 2) + Math.pow(py - centerY, 2));
                    if (dist <= radius) {
                        insideCircle++;
                    }
                }
            }
        }
    }
    
    return total > 0 ? insideCircle / total : 0;
}

// NOMBRE DE COLOR ROBUSTO
function getColorNameRobust(r, g, b) {
    // Calcular HSV para mejor clasificación
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let hue = 0;
    if (delta !== 0) {
        if (max === r) {
            hue = ((g - b) / delta) % 6;
        } else if (max === g) {
            hue = (b - r) / delta + 2;
        } else {
            hue = (r - g) / delta + 4;
        }
        hue = Math.round(hue * 60);
        if (hue < 0) hue += 360;
    }
    
    const saturation = max === 0 ? 0 : delta / max;
    const value = max / 255;
    
    // Blanco, negro, gris
    if (saturation < 0.15) {
        if (value > 0.85) return 'Blanco';
        if (value < 0.25) return 'Negro';
        return 'Gris';
    }
    
    // Colores cromáticos
    if (hue >= 0 && hue < 15) return 'Rojo';
    if (hue >= 15 && hue < 45) return 'Naranja';
    if (hue >= 45 && hue < 75) return 'Amarillo';
    if (hue >= 75 && hue < 150) return 'Verde';
    if (hue >= 150 && hue < 210) return 'Cian';
    if (hue >= 210 && hue < 270) return 'Azul';
    if (hue >= 270 && hue < 330) return 'Morado';
    if (hue >= 330 && hue < 345) return 'Rosa';
    if (hue >= 345) return 'Rojo';
    
    return 'Indefinido';
}

// Dibujar predicciones
function drawPredictions(ctx, predictions) {
    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        
        // Caja
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        
        // Etiqueta
        const label = `${translateClass(prediction.class)} ${(prediction.score * 100).toFixed(0)}%`;
        ctx.font = 'bold 16px Arial';
        
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
        ctx.fillRect(x, y - 25, textWidth + 10, 25);
        
        ctx.fillStyle = '#000';
        ctx.fillText(label, x + 5, y - 7);
    });
}

// Traducir clases
function translateClass(className) {
    const translations = {
        'person': 'Persona', 'car': 'Auto', 'truck': 'Camión', 'bus': 'Autobús',
        'bicycle': 'Bicicleta', 'motorcycle': 'Motocicleta', 'dog': 'Perro',
        'cat': 'Gato', 'bird': 'Pájaro', 'bottle': 'Botella', 'cup': 'Taza',
        'bowl': 'Tazón', 'chair': 'Silla', 'couch': 'Sofá', 'bed': 'Cama',
        'dining table': 'Mesa', 'laptop': 'Laptop', 'cell phone': 'Celular',
        'book': 'Libro', 'clock': 'Reloj', 'sports ball': 'Pelota',
        'apple': 'Manzana', 'banana': 'Plátano', 'orange': 'Naranja',
        'pizza': 'Pizza', 'cake': 'Pastel', 'potted plant': 'Planta',
        'tv': 'TV', 'backpack': 'Mochila', 'umbrella': 'Paraguas',
        'handbag': 'Bolso', 'tie': 'Corbata', 'suitcase': 'Maleta',
        'frisbee': 'Frisbee', 'skis': 'Esquís', 'snowboard': 'Snowboard',
        'kite': 'Cometa', 'baseball bat': 'Bate', 'skateboard': 'Patineta',
        'surfboard': 'Tabla de surf', 'tennis racket': 'Raqueta',
        'wine glass': 'Copa', 'fork': 'Tenedor', 'knife': 'Cuchillo',
        'spoon': 'Cuchara', 'sandwich': 'Sándwich', 'hot dog': 'Hot dog',
        'donut': 'Dona', 'carrot': 'Zanahoria', 'broccoli': 'Brócoli',
        'keyboard': 'Teclado', 'mouse': 'Mouse', 'remote': 'Control',
        'microwave': 'Microondas', 'oven': 'Horno', 'toaster': 'Tostadora',
        'sink': 'Lavabo', 'refrigerator': 'Refrigerador', 'vase': 'Florero',
        'scissors': 'Tijeras', 'teddy bear': 'Osito', 'hair drier': 'Secadora',
        'toothbrush': 'Cepillo'
    };
    return translations[className] || className;
}

// Modal
function showAnalysisModal() {
    analyzedImage.src = currentAnalysis.image;
    
    // Detecciones
    if (currentAnalysis.detections.length > 0) {
        detectionsList.innerHTML = currentAnalysis.detections.map(d => `
            <div class="detection-item">
                <span class="detection-name">${d.class}</span>
                <span class="detection-confidence">${d.confidence}%</span>
            </div>
        `).join('');
    } else {
        detectionsList.innerHTML = '<div class="no-detections">No se detectaron objetos conocidos</div>';
    }
    
    // Color
    colorBox.style.backgroundColor = currentAnalysis.color.rgb;
    colorName.textContent = currentAnalysis.color.name;
    colorHex.textContent = currentAnalysis.color.hex;
    colorRgb.textContent = currentAnalysis.color.rgb;
    
    // Forma
    const shapeIcons = {
        'Círculo': '🔴',
        'Cuadrado': '🟦',
        'Rectángulo': '🟩'
    };
    shapeIcon.textContent = shapeIcons[currentAnalysis.shape] || '📐';
    shapeName.textContent = currentAnalysis.shape;
    
    // Fecha y hora
    analysisDate.textContent = currentAnalysis.date;
    analysisTime.textContent = currentAnalysis.time;
    
    analysisModal.classList.add('active');
}

closeModal.addEventListener('click', () => {
    analysisModal.classList.remove('active');
});

discardBtn.addEventListener('click', () => {
    currentAnalysis = null;
    analysisModal.classList.remove('active');
});

saveBtn.addEventListener('click', () => {
    if (currentAnalysis) {
        records.unshift(currentAnalysis);
        renderRecords();
        currentAnalysis = null;
        analysisModal.classList.remove('active');
    }
});

// Cerrar modal al hacer clic fuera
analysisModal.addEventListener('click', (e) => {
    if (e.target === analysisModal) {
        analysisModal.classList.remove('active');
    }
});

// Renderizar registros
function renderRecords() {
    recordCount.textContent = records.length;
    
    if (records.length === 0) {
        recordsGrid.innerHTML = '<div class="empty-state"><p>🤖 No hay análisis guardados en el historial</p></div>';
        return;
    }
    
    recordsGrid.innerHTML = records.map(record => `
        <div class="record-card">
            <img src="${record.image}" alt="Análisis">
            <div class="record-info">
                <div class="info-row">
                    <strong>📅</strong> ${record.date}
                </div>
                <div class="info-row">
                    <strong>🕐</strong> ${record.time}
                </div>
                <div class="info-row">
                    <strong>🔷</strong> Forma: <strong>${record.shape}</strong>
                </div>
                
                ${record.detections.length > 0 ? `
                    <div class="detections">
                        <strong>🤖 Objetos detectados:</strong>
                        ${record.detections.slice(0, 3).map(d => `
                            <div class="detection-item">
                                <span class="detection-name">${d.class}</span>
                                <span class="detection-confidence">${d.confidence}%</span>
                            </div>
                        `).join('')}
                        ${record.detections.length > 3 ? `<div style="text-align:center; margin-top:8px; color:#999; font-size:0.85rem;">+${record.detections.length - 3} más</div>` : ''}
                    </div>
                ` : '<div class="info-row" style="text-align:center; color:#999;">Sin objetos detectados</div>'}
                
                <div class="color-display">
                    <div class="color-box" style="background: ${record.color.rgb};"></div>
                    <div class="color-info">
                        <div class="color-name">${record.color.name}</div>
                        <div class="color-code">${record.color.hex}</div>
                    </div>
                </div>
                <button class="delete-btn" onclick="deleteRecord(${record.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function deleteRecord(id) {
    records = records.filter(r => r.id !== id);
    renderRecords();
}

clearAll.addEventListener('click', () => {
    if (records.length === 0) return;
    if (confirm('¿Eliminar todos los registros del historial?')) {
        records = [];
        renderRecords();
    }
});

renderRecords();