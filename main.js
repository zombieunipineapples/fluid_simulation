let RENDERER_WIDTH = window.innerWidth;
let RENDERER_HEIGHT = window.innerHeight;

let QUALITY_FACTOR = 1;

let NUM_JACOBI_ITERATIONS = 30;
let SPLAT_RADIUS = 50;

let CANVAS_HEIGHT = RENDERER_HEIGHT / QUALITY_FACTOR;
let CANVAS_WIDTH = RENDERER_WIDTH / QUALITY_FACTOR;

let scene, camera, renderer;

// DENSITY
let densityQuad;
let densityBackQuad;

let densityBuffer;
let densityBackBuffer;

let densityTexture;
let densityBackTexture;

// VELOCITY
let velocityQuad;
let velocityBackQuad;

let velocityBuffer;
let velocityBackBuffer;

let velocityTexture;
let velocityBackTexture;

// PRESSURE
let pressureQuad;
let pressureBackQuad;

let pressureBuffer;
let pressureBackBuffer;

let pressureTexture;
let pressureBackTexture;

// DIVERGENCE
let divergenceQuad;

let divergenceBuffer;

let divergenceTexture;

// VISUALIZE
let visualizeQuad;
let visualizeBuffer;

// SHADERS
let splatShader;
let advectShader;
let divergenceShader;
let jacobiShader;
let gradientShader;
let boundaryShader;
let mainShader;

// Integration Flags
let useImplicit = true; 
let useEuler = false; 

let prevMouseX;
let prevMouseY;

let time = 0;

var stats = new Stats ();
stats.showPanel (0);
document.body.appendChild (stats.dom);

var GUIcontrols = {
  Jacobi_Iterations: NUM_JACOBI_ITERATIONS,
  Splat_Radius: SPLAT_RADIUS,
  Implicit: useImplicit, 
  Euler: useEuler, 
};

var gui = new dat.GUI ();

gui.add (GUIcontrols, 'Jacobi_Iterations', 0, 50).onFinishChange (function () {
  NUM_JACOBI_ITERATIONS = GUIcontrols.Jacobi_Iterations;
  reinit(); 
});

gui.add (GUIcontrols, 'Splat_Radius', 5, 500).onFinishChange (function () {
  SPLAT_RADIUS = GUIcontrols.Splat_Radius;
  splatShader.uniforms.splatRadius.value = SPLAT_RADIUS;
  reinit(); 
});

gui.add (GUIcontrols, 'Euler').onFinishChange (function () {
  useEuler = GUIcontrols.Euler 
  useImplicit = GUIcontrols.Implicit
  reinit(); 
});

gui.add (GUIcontrols, 'Implicit').onFinishChange (function () {
  useEuler = GUIcontrols.Euler 
  useImplicit = GUIcontrols.Implicit
  reinit();
});

function initializeBuffers () {
  const geometry = new THREE.PlaneBufferGeometry (CANVAS_WIDTH, CANVAS_HEIGHT);

  // set up density framebuffer
  densityQuad = new THREE.Mesh (geometry);
  densityBuffer = new THREE.Scene ();
  densityBuffer.add (densityQuad);

  // set up density spare framebuffer
  densityBackQuad = new THREE.Mesh (geometry);
  densityBackBuffer = new THREE.Scene ();
  densityBackBuffer.add (densityBackQuad);

  // set up velocity framebuffer
  velocityQuad = new THREE.Mesh (geometry);
  velocityBuffer = new THREE.Scene ();
  velocityBuffer.add (velocityQuad);

  // set up spare velocity framebuffer
  velocityBackQuad = new THREE.Mesh (geometry);
  velocityBackBuffer = new THREE.Scene ();
  velocityBackBuffer.add (velocityBackQuad);

  // set up pressure framebuffer
  pressureQuad = new THREE.Mesh (geometry);
  pressureBuffer = new THREE.Scene ();
  pressureBuffer.add (pressureQuad);

  // set up spare pressure framebuffer
  pressureBackQuad = new THREE.Mesh (geometry);
  pressureBackBuffer = new THREE.Scene ();
  pressureBackBuffer.add (pressureBackQuad);

  // set up divergence framebuffer
  divergenceQuad = new THREE.Mesh (geometry);
  divergenceBuffer = new THREE.Scene ();
  divergenceBuffer.add (divergenceQuad);

  // set up divergence framebuffer
  divergenceBackQuad = new THREE.Mesh (geometry);
  divergenceBackBuffer = new THREE.Scene ();
  divergenceBackBuffer.add (divergenceBackQuad);

  visualizeQuad = new THREE.Mesh (geometry);
  visualizeBuffer = new THREE.Scene ();
  visualizeBuffer.background = null;
  visualizeBuffer.add (visualizeQuad);
}

function initializeTextures () {
  densityTexture = new THREE.WebGLRenderTarget (CANVAS_WIDTH, CANVAS_HEIGHT, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.FloatType,
    internalFormat: 'RGBA32F',
  });
  densityBackTexture = new THREE.WebGLRenderTarget (
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.FloatType,
      internalFormat: 'RGBA32F',
    }
  );
  velocityTexture = new THREE.WebGLRenderTarget (CANVAS_WIDTH, CANVAS_HEIGHT, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.FloatType,
    internalFormat: 'RGBA32F',
  });
  velocityBackTexture = new THREE.WebGLRenderTarget (
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.FloatType,
      internalFormat: 'RGBA32F',
    }
  );
  pressureTexture = new THREE.WebGLRenderTarget (CANVAS_WIDTH, CANVAS_HEIGHT, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.FloatType,
    internalFormat: 'RGBA32F',
  });
  pressureBackTexture = new THREE.WebGLRenderTarget (
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.FloatType,
      internalFormat: 'RGBA32F',
    }
  );
  divergenceTexture = new THREE.WebGLRenderTarget (
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.FloatType,
      internalFormat: 'RGBA32F',
    }
  );
  divergenceBackTexture = new THREE.WebGLRenderTarget (
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.FloatType,
      internalFormat: 'RGBA32F',
    }
  );

  const geometry = new THREE.PlaneBufferGeometry (CANVAS_WIDTH, CANVAS_HEIGHT);

  var dummyQuad = new THREE.Mesh (geometry);

  dummyQuad.material = new THREE.MeshBasicMaterial ({color: 0x000000});

  let dummyScene = new THREE.Scene ();
  dummyScene.add (dummyQuad);

  renderer.setRenderTarget (densityTexture);
  renderer.render (dummyScene, camera);
  renderer.setRenderTarget (null);

  renderer.setRenderTarget (densityBackTexture);
  renderer.render (dummyScene, camera);
  renderer.setRenderTarget (null);

  renderer.setRenderTarget (velocityTexture);
  renderer.render (dummyScene, camera);
  renderer.setRenderTarget (null);

  renderer.setRenderTarget (velocityBackTexture);
  renderer.render (dummyScene, camera);
  renderer.setRenderTarget (null);

  renderer.setRenderTarget (pressureTexture);
  renderer.render (dummyScene, camera);
  renderer.setRenderTarget (null);

  renderer.setRenderTarget (pressureBackTexture);
  renderer.render (dummyScene, camera);
  renderer.setRenderTarget (null);

  renderer.setRenderTarget (divergenceTexture);
  renderer.render (dummyScene, camera);
  renderer.setRenderTarget (null);
}

function initializeShaders () {
  splatShader = new THREE.ShaderMaterial ({
    uniforms: {
      bufferTexture: {type: 't', value: densityTexture},
      splatPos: {type: 'v2', value: null},
      splatVal: {type: 'v4', value: null},
      splatRadius: {value: SPLAT_RADIUS},
      inverseCanvasSize: {
        type: 'v2',
        value: new THREE.Vector2 (1.0 / CANVAS_WIDTH, 1.0 / CANVAS_HEIGHT),
      },
      isVelocity: {value: false},
    },
    fragmentShader: document.getElementById ('splatShader').innerHTML,
    opacity: 1.0,
    blending: THREE.NoBlending,
  });

  advectShader = new THREE.ShaderMaterial ({
    uniforms: {
      toAdvectTexture: {type: 't', value: null},
      velocityTexture: {type: 't', value: null},
      dt: {value: 0.0},
      inverseCanvasSize: {
        type: 'v2',
        value: new THREE.Vector2 (1.0 / CANVAS_WIDTH, 1.0 / CANVAS_HEIGHT),
      },
      isVelocity: {value: false},
      useEuler: {value: useEuler}, 
      useImplicit: {value: useImplicit}, 
    },
    vertexShader: document.getElementById ('vertShader').innerHTML,
    fragmentShader: document.getElementById ('advectShader').innerHTML,
    opacity: 1.0,
    blending: THREE.NoBlending,
  });

  divergenceShader = new THREE.ShaderMaterial ({
    uniforms: {
      velocityTexture: {type: 't', value: null},
      inverseCanvasSize: {
        type: 'v2',
        value: new THREE.Vector2 (1.0 / CANVAS_WIDTH, 1.0 / CANVAS_HEIGHT),
      },
    },
    vertexShader: document.getElementById ('vertShader').innerHTML,
    fragmentShader: document.getElementById ('divergenceShader').innerHTML,
    opacity: 1.0,
    blending: THREE.NoBlending,
  });

  jacobiShader = new THREE.ShaderMaterial ({
    uniforms: {
      xTex: {type: 't', value: null},
      bTex: {type: 't', value: null},
      alpha: {value: -1.0 / (CANVAS_WIDTH * CANVAS_HEIGHT)},
      inverseBeta: {value: 0.25},
      inverseCanvasSize: {
        type: 'v2',
        value: new THREE.Vector2 (1.0 / CANVAS_WIDTH, 1.0 / CANVAS_HEIGHT),
      },
    },
    vertexShader: document.getElementById ('vertShader').innerHTML,
    fragmentShader: document.getElementById ('jacobiShader').innerHTML,
    opacity: 1.0,
    blending: THREE.NoBlending,
  });

  gradientShader = new THREE.ShaderMaterial ({
    uniforms: {
      velocityTexture: {type: 't', value: null},
      pressureTexture: {type: 't', value: null},
      inverseCanvasSize: {
        type: 'v2',
        value: new THREE.Vector2 (1.0 / CANVAS_WIDTH, 1.0 / CANVAS_HEIGHT),
      },
    },
    vertexShader: document.getElementById ('vertShader').innerHTML,
    fragmentShader: document.getElementById ('gradientShader').innerHTML,
    opacity: 1.0,
    blending: THREE.NoBlending,
  });

  boundaryShader = new THREE.ShaderMaterial ({
    uniforms: {
      inputTexture: {type: 't', value: null},
      inverseCanvasSize: {
        type: 'v2',
        value: new THREE.Vector2 (1.0 / CANVAS_WIDTH, 1.0 / CANVAS_HEIGHT),
      },
    },
    vertexShader: document.getElementById ('vertShader').innerHTML,
    fragmentShader: document.getElementById ('boundaryShader').innerHTML,
    opacity: 1.0,
  });

  mainShader = new THREE.ShaderMaterial ({
    uniforms: {
      inputTexture: {type: 't', value: densityTexture},
      inverseCanvasSize: {
        type: 'v2',
        value: new THREE.Vector2 (1.0 / CANVAS_WIDTH, 1.0 / CANVAS_HEIGHT),
      },
    },
    vertexShader: document.getElementById ('vertShader').innerHTML,
    fragmentShader: document.getElementById ('fragShader').innerHTML,
    opacity: 1.0,
    blending: THREE.NormalBlending,
  });
}

function reinit () 
{
  initializeTextures(); 
}

function init () {
  camera = new THREE.OrthographicCamera (
    CANVAS_WIDTH / -2,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    CANVAS_HEIGHT / -2,
    1,
    1000
  );

  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer ({alpha: true});
  renderer.setClearColor (0x000000, 1.0);
  renderer.setSize (
    CANVAS_WIDTH * QUALITY_FACTOR,
    CANVAS_HEIGHT * QUALITY_FACTOR
  );

  document.body.appendChild (renderer.domElement);

  initializeBuffers ();
  initializeShaders ();
  initializeTextures ();
}

function animate () {
  requestAnimationFrame (animate);
  stats.begin ();
  advectVelocity (time);
  divergeVelocity ();
  jacobiPressure ();

  var tempVel = velocityTexture;
  velocityTexture = velocityBackTexture;
  velocityBackTexture = tempVel;
  velocityQuad.material.map = velocityBackTexture;
  velocityBackQuad.material.map = velocityTexture;

  subtractGradient ();

  advectDensity (time);

  var tempVel = velocityTexture;
  velocityTexture = velocityBackTexture;
  velocityBackTexture = tempVel;
  velocityQuad.material.map = velocityBackTexture;
  velocityBackQuad.material.map = velocityTexture;

  var tempPressure = pressureTexture;
  pressureTexture = pressureBackTexture;
  pressureBackTexture = tempPressure;
  pressureQuad.material.map = pressureBackTexture;
  pressureBackQuad.material.map = pressureTexture;

  var tempDensity = densityTexture;
  densityTexture = densityBackTexture;
  densityBackTexture = tempDensity;
  densityQuad.material.map = densityBackTexture;
  densityBackQuad.material.map = densityTexture;

  renderer.clear ();

  visualize ();
  time += 0.0001;
  stats.end ();
}

var mouseDown = false;
function UpdateMousePosition (X, Y) {
  var mouseX = X / CANVAS_WIDTH;
  var mouseY = (CANVAS_HEIGHT - Y) / CANVAS_HEIGHT;

  if (mouseDown && X < CANVAS_WIDTH && Y < CANVAS_HEIGHT && X > 0 && Y > 0) {
    addDensity (mouseX, mouseY);
    addVelocity (mouseX, mouseY, mouseX - prevMouseX, mouseY - prevMouseY);
    prevMouseX = mouseX;
    prevMouseY = mouseY;
  }
}
document.onmousemove = function (event) {
  UpdateMousePosition (
    event.clientX / QUALITY_FACTOR,
    event.clientY / QUALITY_FACTOR
  );
};

document.onmousedown = function (event) {
  mouseDown = true;
};
document.onmouseup = function (event) {
  mouseDown = false;
};

document.ontouchmove = function (event) {
  UpdateMousePosition (
    event.clientX / QUALITY_FACTOR,
    event.clientY / QUALITY_FACTOR
  );
};

document.ontouchstart = function (event) {
  addDensity (0, 0);
  addVelocity (0, 0, 1, 1);
  mouseDown = true;
};
document.ontouchend = function (event) {
  mouseDown = false;
};

function visualize () {
  renderer.setRenderTarget (null);
  mainShader.uniforms.inputTexture.value = densityTexture;
  visualizeQuad.material = mainShader;
  visualizeQuad.material.transparent = true;
  renderer.render (visualizeBuffer, camera);
}

function addDensity (posX, posY) {
  renderer.setRenderTarget (densityBackTexture);
  splatShader.uniforms.bufferTexture.value = densityTexture;
  splatShader.uniforms.splatPos.value = new THREE.Vector2 (posX, posY);
  splatShader.uniforms.splatVal.value = new THREE.Vector4 (
    1.0,
    Math.random (posX) * Math.random (),
    Math.random (posY) * Math.random (),
    0.0
  );
  splatShader.uniforms.isVelocity.value = false;
  densityBackQuad.material = splatShader;
  renderer.render (densityBackBuffer, camera);
  renderer.setRenderTarget (null);

  var t = densityTexture;
  densityTexture = densityBackTexture;
  densityBackTexture = t;
  densityQuad.material.map = densityTexture;
  densityBackQuad.material.map = densityBackTexture;

  splatShader.uniforms.bufferTexture.value = null;
}

function addVelocity (posX, posY, dirX, dirY) {
  renderer.setRenderTarget (velocityBackTexture);
  splatShader.uniforms.bufferTexture.value = velocityTexture;
  splatShader.uniforms.splatPos.value = new THREE.Vector2 (posX, posY);
  splatShader.uniforms.splatVal.value = new THREE.Vector4 (
    dirX * 100000 / QUALITY_FACTOR,
    dirY * 100000 / QUALITY_FACTOR,
    0.0,
    0.0
  );
  splatShader.uniforms.isVelocity.value = true;
  velocityBackQuad.material = splatShader;
  renderer.render (velocityBackBuffer, camera);
  renderer.setRenderTarget (null);

  var t = velocityTexture;
  velocityTexture = velocityBackTexture;
  velocityBackTexture = t;
  velocityQuad.material.map = velocityBackTexture;
  velocityBackQuad.material.map = velocityTexture;

  splatShader.uniforms.bufferTexture.value = null;
}

function advectDensity (timestep) {
  renderer.setRenderTarget (densityBackTexture);
  advectShader.uniforms.isVelocity.value = false;
  advectShader.uniforms.useEuler.value = useEuler; 
  advectShader.uniforms.useImplicit.value = useImplicit; 
  advectShader.uniforms.toAdvectTexture.value = densityTexture;
  advectShader.uniforms.velocityTexture.value = velocityTexture;
  advectShader.uniforms.dt.value = timestep;
  densityBackQuad.material = advectShader;
  renderer.render (densityBackBuffer, camera);
  renderer.setRenderTarget (null);

  advectShader.uniforms.isVelocity.value = false;
  advectShader.uniforms.toAdvectTexture.value = null;
  advectShader.uniforms.velocityTexture.value = null;
  advectShader.uniforms.dt.value = 0.0;
}

function advectVelocity (timestep) {
  renderer.setRenderTarget (velocityBackTexture);
  advectShader.uniforms.isVelocity.value = true;
  advectShader.uniforms.toAdvectTexture.value = velocityTexture;
  advectShader.uniforms.velocityTexture.value = velocityTexture;
  advectShader.uniforms.dt.value = timestep;
  velocityBackQuad.material = advectShader;
  renderer.render (velocityBackBuffer, camera);
  renderer.setRenderTarget (null);

  advectShader.uniforms.isVelocity.value = false;
  advectShader.uniforms.toAdvectTexture.value = null;
  advectShader.uniforms.velocityTexture.value = null;
  advectShader.uniforms.dt.value = 0.0;
}

function handleBoundaries () {
  renderer.setRenderTarget (velocityBackTexture);
  boundaryShader.uniforms.inputTexture.value = velocityTexture;
  velocityBackQuad.material = boundaryShader;
  renderer.render (velocityBackBuffer, camera);
  renderer.setRenderTarget (null);
  boundaryShader.uniforms.inputTexture.value = null;

  renderer.setRenderTarget (densityBackTexture);
  boundaryShader.uniforms.inputTexture.value = densityTexture;
  densityBackQuad.material = boundaryShader;
  renderer.render (densityBackBuffer, camera);
  renderer.setRenderTarget (null);
  boundaryShader.uniforms.inputTexture.value = null;

  renderer.setRenderTarget (pressureBackTexture);
  boundaryShader.uniforms.inputTexture.value = pressureTexture;
  pressureBackQuad.material = boundaryShader;
  renderer.render (pressureBackBuffer, camera);
  renderer.setRenderTarget (null);
  boundaryShader.uniforms.inputTexture.value = null;
}

function divergeVelocity () {
  renderer.setRenderTarget (divergenceTexture);
  divergenceShader.uniforms.velocityTexture.value = velocityBackTexture;
  divergenceQuad.material = divergenceShader;
  renderer.render (divergenceBuffer, camera);
  renderer.setRenderTarget (null);

  divergenceShader.uniforms.velocityTexture.value = null;
}

function jacobiPressure () {
  let dummyScene = new THREE.Scene ();
  dummyScene.background = new THREE.Color (0x000000);

  renderer.setRenderTarget (pressureTexture);
  renderer.render (dummyScene, camera);
  renderer.setRenderTarget (null);

  renderer.setRenderTarget (pressureBackTexture);
  renderer.render (dummyScene, camera);
  renderer.setRenderTarget (null);

  for (let index = 0; index < NUM_JACOBI_ITERATIONS; index++) {
    renderer.setRenderTarget (pressureBackTexture);
    jacobiShader.uniforms.xTex.value = pressureTexture;
    jacobiShader.uniforms.bTex.value = divergenceTexture;
    pressureBackQuad.material = jacobiShader;
    renderer.render (pressureBackBuffer, camera);

    var t = pressureTexture;
    pressureTexture = pressureBackTexture;
    pressureBackTexture = t;
    pressureQuad.material.map = pressureBackTexture;
    pressureBackQuad.material.map = pressureTexture;
  }

  jacobiShader.uniforms.xTex.value = null;
  jacobiShader.uniforms.bTex.value = null;

  renderer.setRenderTarget (null);
}

function subtractGradient () {
  renderer.setRenderTarget (velocityBackTexture);
  gradientShader.uniforms.velocityTexture.value = velocityTexture;
  gradientShader.uniforms.pressureTexture.value = pressureTexture;

  velocityBackQuad.material = gradientShader;
  renderer.render (velocityBackBuffer, camera);
  renderer.setRenderTarget (null);
}

init ();
animate ();
