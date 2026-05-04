const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_uv;

void main() {
  v_uv = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform sampler2D u_texture;
uniform bool u_hasTexture;
uniform float u_opacity;
uniform vec2 u_resolution;
uniform vec2 u_uvMin;
uniform vec2 u_uvMax;
varying vec2 v_uv;

void main() {
  if (u_hasTexture) {
    vec2 uv = mix(u_uvMin, u_uvMax, v_uv);
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

interface ZoneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

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
  private readonly texCoordBuffer: WebGLBuffer;
  // Per-video texture cache: retains the last decoded frame so that seeking
  // (readyState < HAVE_CURRENT_DATA) does not cause a flash to background.
  private readonly textureCache: Map<HTMLVideoElement, WebGLTexture> = new Map();
  private readonly hasTextureLocation: WebGLUniformLocation;
  private readonly opacityLocation: WebGLUniformLocation;
  private readonly resolutionLocation: WebGLUniformLocation;
  private readonly uvMinLocation: WebGLUniformLocation;
  private readonly uvMaxLocation: WebGLUniformLocation;

  private readonly clamp01 = (value: number) => Math.max(0, Math.min(1, value));

  private setPositionQuad(
    left: number,
    top: number,
    width: number,
    height: number,
  ) {
    const canvasWidth = Math.max(1, this.canvas.width);
    const canvasHeight = Math.max(1, this.canvas.height);

    const x1 = (left / canvasWidth) * 2 - 1;
    const x2 = ((left + width) / canvasWidth) * 2 - 1;
    const yTop = 1 - (top / canvasHeight) * 2;
    const yBottom = 1 - ((top + height) / canvasHeight) * 2;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([x1, yBottom, x2, yBottom, x1, yTop, x2, yTop]),
      this.gl.DYNAMIC_DRAW,
    );
  }

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      throw new Error("WebGL is not supported in this browser");
    }

    const program = createProgram(gl);
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    const hasTextureLocation = gl.getUniformLocation(program, "u_hasTexture");
    const opacityLocation = gl.getUniformLocation(program, "u_opacity");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const textureLocation = gl.getUniformLocation(program, "u_texture");
    const uvMinLocation = gl.getUniformLocation(program, "u_uvMin");
    const uvMaxLocation = gl.getUniformLocation(program, "u_uvMax");

    if (
      !hasTextureLocation ||
      !opacityLocation ||
      !resolutionLocation ||
      !textureLocation ||
      !uvMinLocation ||
      !uvMaxLocation
    ) {
      throw new Error("Failed to resolve WebGL uniforms");
    }

    const positionBuffer = gl.createBuffer();
    const texCoordBuffer = gl.createBuffer();
    if (!positionBuffer || !texCoordBuffer) {
      throw new Error("Failed to create WebGL buffers");
    }

    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;
    this.hasTextureLocation = hasTextureLocation;
    this.opacityLocation = opacityLocation;
    this.resolutionLocation = resolutionLocation;
    this.uvMinLocation = uvMinLocation;
    this.uvMaxLocation = uvMaxLocation;

    gl.useProgram(program);
    gl.uniform1i(textureLocation, 0);
    gl.uniform1f(this.opacityLocation, 1);
    gl.uniform2f(this.uvMinLocation, 0, 0);
    gl.uniform2f(this.uvMaxLocation, 1, 1);

    // No initial texture; textures are created per-video on first upload.

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      // Coordinates keep X orientation normal and flip Y exactly once.
      new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
      gl.STATIC_DRAW,
    );

    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);

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
    this.setPositionQuad(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform1i(this.hasTextureLocation, 0);
    gl.uniform1f(this.opacityLocation, 1);
    gl.uniform2f(this.uvMinLocation, 0, 0);
    gl.uniform2f(this.uvMaxLocation, 1, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private getOrCreateTexture(video: HTMLVideoElement): WebGLTexture {
    const cached = this.textureCache.get(video);
    if (cached) return cached;
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error("Failed to create WebGL texture");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    this.textureCache.set(video, tex);
    return tex;
  }

  /** Call when a video element is no longer needed to free its GPU texture. */
  releaseVideoTexture(video: HTMLVideoElement) {
    const tex = this.textureCache.get(video);
    if (tex) {
      this.gl.deleteTexture(tex);
      this.textureCache.delete(video);
    }
  }

  private drawLayer(
    video: HTMLVideoElement,
    opacity: number,
    centerX: number,
    centerY: number,
    scale: number,
    zone: ZoneRect,
  ) {
    const gl = this.gl;
    const isReady = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    const texture = this.getOrCreateTexture(video);

    // Upload a new frame only when the video has one ready.
    // When seeking, keep the existing texture (last decoded frame) so there
    // is no flash to background while the decoder catches up.
    if (isReady) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } else {
      // If we have never uploaded a frame for this video yet, skip drawing
      // entirely — there is nothing to show.
      const hasData = (texture as WebGLTexture & { _hasData?: boolean })._hasData;
      if (!hasData) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    // Mark that at least one frame has been uploaded.
    (texture as WebGLTexture & { _hasData?: boolean })._hasData = true;

    const videoAspect =
      (video.videoWidth || this.canvas.width) /
      Math.max(1, video.videoHeight || this.canvas.height);

    const zoneAspect = zone.width / Math.max(1, zone.height);
    const renderWidth =
      videoAspect > zoneAspect ? zone.width : zone.height * videoAspect;
    const renderHeight =
      videoAspect > zoneAspect
        ? zone.width / Math.max(videoAspect, 0.00001)
        : zone.height;
    const scaleValue = Math.max(0.2, Math.min(4, scale));

    const targetCenterX = zone.left + this.clamp01(centerX) * zone.width;
    const targetCenterY = zone.top + this.clamp01(centerY) * zone.height;

    this.setPositionQuad(
      targetCenterX - (renderWidth * scaleValue) / 2,
      targetCenterY - (renderHeight * scaleValue) / 2,
      renderWidth * scaleValue,
      renderHeight * scaleValue,
    );

    gl.uniform1i(this.hasTextureLocation, 1);
    gl.uniform1f(this.opacityLocation, opacity);
    gl.uniform2f(this.uvMinLocation, 0, 0);
    gl.uniform2f(this.uvMaxLocation, 1, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  draw(
    videos: Array<{
      element: HTMLVideoElement;
      x: number;
      y: number;
      scale: number;
    }>,
    zone: ZoneRect,
  ) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform2f(
      this.resolutionLocation,
      this.canvas.width,
      this.canvas.height,
    );

    this.drawBackground();

    const scissorLeft = Math.max(0, Math.floor(zone.left));
    const scissorTop = Math.max(0, Math.floor(zone.top));
    const scissorWidth = Math.max(1, Math.floor(zone.width));
    const scissorHeight = Math.max(1, Math.floor(zone.height));

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      scissorLeft,
      Math.max(0, this.canvas.height - scissorTop - scissorHeight),
      scissorWidth,
      scissorHeight,
    );

    for (const video of videos) {
      this.drawLayer(video.element, 1, video.x, video.y, video.scale, zone);
    }

    gl.disable(gl.SCISSOR_TEST);
  }

  dispose() {
    const gl = this.gl;
    for (const tex of this.textureCache.values()) {
      gl.deleteTexture(tex);
    }
    this.textureCache.clear();
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.deleteProgram(this.program);
  }
}
