const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform sampler2D u_texture;
uniform bool u_hasTexture;
uniform float u_opacity;
uniform vec2 u_resolution;
varying vec2 v_uv;

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  if (u_hasTexture) {
    vec4 color = texture2D(u_texture, uv);
    gl_FragColor = vec4(color.rgb, color.a * u_opacity);
    return;
  }

  vec2 st = gl_FragCoord.xy / u_resolution;
  vec3 top = vec3(0.09, 0.10, 0.14);
  vec3 bottom = vec3(0.05, 0.06, 0.09);
  gl_FragColor = vec4(mix(bottom, top, st.y), 1.0);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    VERTEX_SHADER_SOURCE,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    FRAGMENT_SHADER_SOURCE,
  );

  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create WebGL program");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "Unknown program link error";
    gl.deleteProgram(program);
    throw new Error(info);
  }

  return program;
}

export class WebGLPreviewRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private readonly hasTextureLocation: WebGLUniformLocation;
  private readonly opacityLocation: WebGLUniformLocation;
  private readonly resolutionLocation: WebGLUniformLocation;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      throw new Error("WebGL is not supported in this browser");
    }

    const program = createProgram(gl);
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const hasTextureLocation = gl.getUniformLocation(program, "u_hasTexture");
    const opacityLocation = gl.getUniformLocation(program, "u_opacity");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const textureLocation = gl.getUniformLocation(program, "u_texture");

    if (
      !hasTextureLocation ||
      !opacityLocation ||
      !resolutionLocation ||
      !textureLocation
    ) {
      throw new Error("Failed to resolve WebGL uniforms");
    }

    const positionBuffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!positionBuffer || !texture) {
      throw new Error("Failed to create WebGL buffers");
    }

    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.positionBuffer = positionBuffer;
    this.texture = texture;
    this.hasTextureLocation = hasTextureLocation;
    this.opacityLocation = opacityLocation;
    this.resolutionLocation = resolutionLocation;

    gl.useProgram(program);
    gl.uniform1i(textureLocation, 0);
    gl.uniform1f(this.opacityLocation, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  resize(width: number, height: number) {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));

    if (this.canvas.width === nextWidth && this.canvas.height === nextHeight) {
      return;
    }

    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    this.gl.viewport(0, 0, nextWidth, nextHeight);
  }

  private drawBackground() {
    const gl = this.gl;
    gl.uniform1i(this.hasTextureLocation, 0);
    gl.uniform1f(this.opacityLocation, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private drawLayer(video: HTMLVideoElement, opacity: number) {
    const gl = this.gl;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.uniform1i(this.hasTextureLocation, 1);
    gl.uniform1f(this.opacityLocation, opacity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  draw(videos: HTMLVideoElement[]) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform2f(
      this.resolutionLocation,
      this.canvas.width,
      this.canvas.height,
    );

    this.drawBackground();

    for (const video of videos) {
      this.drawLayer(video, 1);
    }
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteProgram(this.program);
  }
}
