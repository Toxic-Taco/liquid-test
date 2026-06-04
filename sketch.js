 // Mobile: Sidebar toggle
      if ('ontouchstart' in window || window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Toggle Sidebar';
        toggleBtn.style.width = '100%';
        toggleBtn.style.padding = '10px';
        toggleBtn.style.backgroundColor = '#444';
        toggleBtn.style.color = 'white';
        toggleBtn.style.border = 'none';
        toggleBtn.style.borderRadius = '3px';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.marginBottom = '20px';
        toggleBtn.style.fontFamily = 'monospace';

        toggleBtn.addEventListener('click', function() {
          sidebar.classList.toggle('collapsed');
          const newWidth = sidebar.classList.contains('collapsed') ? windowWidth : windowWidth - 300;
          resizeCanvas(newWidth, windowHeight);
          gradientGraphics.resizeCanvas(width, height);
          updateGradient();
        });

        sidebar.insertBefore(toggleBtn, sidebar.firstChild);
      }

      // Save button handler
      document.getElementById('save-button').addEventListener('click', function(e) {
        e.stopPropagation();
        saveCanvas('gradient_water_effect', 'png');
      });

// Global variables for UI controls
let distortionFactor = 0.15;
let waveFactor = 0.2;
let noiseFactor = 0.5;
let gradientColors = [
  '#98D2EB',
  '#677D83',
  '#FABFC4',
  '#DB8A74',
  '#2F243A',
  '#000000'
];
let backgroundColor = '#000000';

let gradientGraphics;
let distortionShader;
let distortionStrength = 0;
let targetDistortion = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let mouseSpeed = 0;

function setup() {
  const canvas = createCanvas(windowWidth - 300, windowHeight, WEBGL);
  canvas.parent('canvas-container');

  // Create color input fields
  const colorControls = document.getElementById('color-controls');
  gradientColors.forEach((color, index) => {
    const div = document.createElement('div');
    div.style.marginBottom = '10px';

    const label = document.createElement('label');
    label.textContent = `Color ${index + 1}:`;
    label.style.display = 'block';
    label.style.marginBottom = '5px';

    const inputContainer = document.createElement('div');
    inputContainer.style.display = 'flex';
    inputContainer.style.alignItems = 'center';
    inputContainer.style.gap = '10px';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = color;
    input.style.flex = '1';
    input.style.padding = '5px';
    input.style.backgroundColor = '#444';
    input.style.color = 'white';
    input.style.border = '1px solid #666';
    input.style.borderRadius = '3px';

    const preview = document.createElement('div');
    preview.style.width = '20px';
    preview.style.height = '20px';
    preview.style.backgroundColor = color;
    preview.style.border = '1px solid #666';
    preview.style.borderRadius = '3px';

    input.addEventListener('input', function() {
      let value = this.value;
      if (!value.startsWith('#')) {
        value = '#' + value;
      }
      if (/^#[0-9A-Fa-f]{3,6}$/.test(value)) {
        gradientColors[index] = value;
        preview.style.backgroundColor = value;
        updateGradient();
      }
    });

    inputContainer.appendChild(input);
    inputContainer.appendChild(preview);
    div.appendChild(label);
    div.appendChild(inputContainer);
    colorControls.appendChild(div);
  });

  const bgDiv = document.createElement('div');
  bgDiv.style.marginBottom = '10px';
  bgDiv.style.marginTop = '15px';

  const bgLabel = document.createElement('label');
  bgLabel.textContent = 'Background Color:';
  bgLabel.style.display = 'block';
  bgLabel.style.marginBottom = '5px';

  const bgInputContainer = document.createElement('div');
  bgInputContainer.style.display = 'flex';
  bgInputContainer.style.alignItems = 'center';
  bgInputContainer.style.gap = '10px';

  const bgInput = document.createElement('input');
  bgInput.type = 'text';
  bgInput.value = backgroundColor;
  bgInput.style.flex = '1';
  bgInput.style.padding = '5px';
  bgInput.style.backgroundColor = '#444';
  bgInput.style.color = 'white';
  bgInput.style.border = '1px solid #666';
  bgInput.style.borderRadius = '3px';

  const bgPreview = document.createElement('div');
  bgPreview.style.width = '20px';
  bgPreview.style.height = '20px';
  bgPreview.style.backgroundColor = backgroundColor;
  bgPreview.style.border = '1px solid #666';
  bgPreview.style.borderRadius = '3px';

  bgInput.addEventListener('input', function() {
    let value = this.value;
    if (!value.startsWith('#')) {
      value = '#' + value;
    }
    if (/^#[0-9A-Fa-f]{3,6}$/.test(value)) {
      backgroundColor = value;
      bgPreview.style.backgroundColor = value;
      updateGradient();
    }
  });

  bgInputContainer.appendChild(bgInput);
  bgInputContainer.appendChild(bgPreview);
  bgDiv.appendChild(bgLabel);
  bgDiv.appendChild(bgInputContainer);
  colorControls.appendChild(bgDiv);

  document.getElementById('distortionFactor').addEventListener('input', function() {
    distortionFactor = parseFloat(this.value);
    document.getElementById('distortionFactorValue').textContent = distortionFactor.toFixed(3);
  });

  document.getElementById('waveFactor').addEventListener('input', function() {
    waveFactor = parseFloat(this.value);
    document.getElementById('waveFactorValue').textContent = waveFactor.toFixed(2);
  });

  document.getElementById('noiseFactor').addEventListener('input', function() {
    noiseFactor = parseFloat(this.value);
    document.getElementById('noiseFactorValue').textContent = noiseFactor.toFixed(1);
  });

  gradientGraphics = createGraphics(width, height, P2D);
  updateGradient();

  const vertSrc = `
    attribute vec3 aPosition;
    attribute vec2 aTexCoord;
    varying vec2 vTexCoord;
    void main() {
      vTexCoord = aTexCoord;
      gl_Position = vec4(aPosition, 1.0);
    }
  `;

  const fragSrc = `
    precision highp float;
    uniform sampler2D texture;
    uniform float time;
    uniform float distortion;
    uniform vec2 mousePos;
    uniform float distortionFactor;
    uniform float waveFactor;
    uniform float noiseFactor;
    varying vec2 vTexCoord;

    float hash(vec2 p) {
      p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
      return -1.0 + 2.0 * fract(p.x * p.y * (p.x + p.y));
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)),
                       hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)),
                       hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    void main() {
      vec2 uv = vTexCoord;
      vec2 mouseCenter = mousePos;
      float distToMouse = distance(uv, mouseCenter);

      float n = noise(uv * 5.0 + time * 0.1);
      float n2 = noise(uv * 8.0 + time * 0.13);
      float n3 = noise(uv * 12.0 + time * 0.17);

      float influence = exp(-distToMouse * 8.0);
      float distort = distortion * distortionFactor * influence;

      vec2 distortedUv = uv;
      distortedUv.x += n * distort;
      distortedUv.y += n2 * distort;

      float wave = sin(distance(uv, mouseCenter) * 20.0 - time * 10.0) * waveFactor;
      distortedUv.x += wave * distort * 0.7;
      distortedUv.y += wave * distort * 0.7;

      distortedUv.x += n3 * distort * noiseFactor;

      vec4 texColor = texture2D(texture, distortedUv);
      gl_FragColor = texColor;
    }
  `;

  distortionShader = createShader(vertSrc, fragSrc);
}

function hexToP5Color(hex) {
  hex = hex.replace('#', '');
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    return color(0, 0, 0);
  }
  return color(r, g, b);
}

function updateGradient() {
  gradientGraphics.clear();
  gradientGraphics.background(hexToP5Color(backgroundColor));
  const p5Colors = gradientColors.map(hexToP5Color);

  gradientGraphics.push();
  gradientGraphics.translate(gradientGraphics.width/2, gradientGraphics.height/2);
  const size = min(gradientGraphics.width, gradientGraphics.height);
  gradientGraphics.fillGradient('radial', {
    from: [0, 0, 0],
    to: [0, 0, size/2],
    steps: p5Colors
  });
  gradientGraphics.noStroke();
  gradientGraphics.ellipse(0, 0, size, size);
  gradientGraphics.pop();
}

function draw() {
  const currentSpeed = dist(mouseX, mouseY, lastMouseX, lastMouseY);
  mouseSpeed = lerp(mouseSpeed, currentSpeed, 0.1);
  lastMouseX = mouseX;
  lastMouseY = mouseY;

  targetDistortion = map(mouseSpeed, 0, 50, 0, 100);
  distortionStrength = lerp(distortionStrength, targetDistortion, 0.1);

  clear();
  background(hexToP5Color(backgroundColor));

  shader(distortionShader);
  distortionShader.setUniform('texture', gradientGraphics);
  distortionShader.setUniform('time', millis() * 0.001);
  distortionShader.setUniform('distortion', distortionStrength);
  distortionShader.setUniform('mousePos', [mouseX/width, 1.0 - mouseY/height]);
  distortionShader.setUniform('distortionFactor', distortionFactor);
  distortionShader.setUniform('waveFactor', waveFactor);
  distortionShader.setUniform('noiseFactor', noiseFactor);

  beginShape();
  vertex(-1, -1, 0, 0, 0);
  vertex(1, -1, 0, 1, 0);
  vertex(1, 1, 0, 1, 1);
  vertex(-1, 1, 0, 0, 1);
  endShape(CLOSE);

  resetShader();
}

function windowResized() {
  const sidebar = document.getElementById('sidebar');
  const sidebarWidth = sidebar.classList.contains('collapsed') ? 0 : 300;
  resizeCanvas(windowWidth - sidebarWidth, windowHeight);
  gradientGraphics.resizeCanvas(width, height);
  updateGradient();
}

function keyPressed() {
  if (key === '5') {
    saveCanvas('gradient_water_effect', 'png');
  }
}

function touchStarted() {
  if (touches.length >= 2) {
    let sumX = 0, sumY = 0;
    for (let t of touches) {
      sumX += t.x;
      sumY += t.y;
    }
    mouseX = sumX / touches.length;
    mouseY = sumY / touches.length;
    mouseSpeed = 50;
  }
  return false;
}

function touchMoved() {
  if (touches.length >= 2) {
    let sumX = 0, sumY = 0;
    for (let t of touches) {
      sumX += t.x;
      sumY += t.y;
    }
    const newX = sumX / touches.length;
    const newY = sumY / touches.length;
    mouseSpeed = dist(mouseX, mouseY, newX, newY) * 2;
    mouseX = newX;
    mouseY = newY;
  }
  return false;
}
