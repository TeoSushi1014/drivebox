import React, { useRef, useEffect } from 'react';

interface LiquidEtherProps {
  style?: React.CSSProperties;
  width?: string;
  height?: string;
  colors?: [string, string, string];
  mouseForce?: number;
  cursorSize?: number;
  isViscous?: boolean;
  viscous?: number;
  iterationsViscous?: number;
  iterationsPoisson?: number;
  resolution?: [number, number];
  isBounce?: boolean;
  autoDemo?: boolean;
  autoSpeed?: [number, number];
  autoIntensity?: [number, number];
  takeoverDuration?: [number, number];
  autoResumeDuration?: [number, number];
}

const LiquidEther: React.FC<LiquidEtherProps> = ({
  style = {},
  width = '100%',
  height = '600px',
  colors = ['#5527FF', '#FF0FFC', '#B10FEF'],
  mouseForce = 20,
  cursorSize = 130,
  isViscous = false,
  viscous = 30,
  iterationsViscous = 32,
  iterationsPoisson = 32,
  resolution = [0.5, 0.5],
  isBounce = false,
  autoDemo = true,
  autoSpeed = [0.5, 0.5],
  autoIntensity = [2.2, 2.2],
  takeoverDuration = [0.25, 0.25],
  autoResumeDuration = [3000, 3000]
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl2');
    if (!gl) return;

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fragment shader for liquid ether effect
    const fragmentShaderSource = `
      precision mediump float;
      uniform vec2 resolution;
      uniform float time;
      uniform vec2 mouse;
      uniform vec3 colors[3];
      uniform float mouseForce;
      uniform float cursorSize;

      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float smoothNoise(vec2 p) {
        vec2 inter = smoothstep(0.0, 1.0, fract(p));
        float s = mix(noise(floor(p)), noise(floor(p) + vec2(1.0, 0.0)), inter.x);
        float n = mix(noise(floor(p) + vec2(0.0, 1.0)), noise(floor(p) + vec2(1.0, 1.0)), inter.x);
        return mix(s, n, inter.y);
      }

      float fractalNoise(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 6; i++) {
          value += amplitude * smoothNoise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec2 p = uv * 8.0 - 4.0;
        
        float t = time * 0.8;
        
        // Mouse interaction
        vec2 m = mouse / resolution.xy;
        float mouseDist = length(uv - m);
        float mouseEffect = smoothstep(cursorSize / resolution.x, 0.0, mouseDist) * mouseForce;
        
        // Liquid simulation
        vec2 offset = vec2(
          fractalNoise(p + vec2(t * 0.1, t * 0.15)) * 2.0 - 1.0,
          fractalNoise(p.yx + vec2(t * 0.12, t * 0.08)) * 2.0 - 1.0
        );
        
        offset += mouseEffect * normalize(uv - m) * 0.5;
        
        float n1 = fractalNoise(p + offset + t * 0.2);
        float n2 = fractalNoise(p * 1.5 + offset.yx + t * 0.3);
        float n3 = fractalNoise(p * 2.0 - offset + t * 0.1);
        
        // Color mixing
        vec3 color1 = colors[0];
        vec3 color2 = colors[1];
        vec3 color3 = colors[2];
        
        vec3 finalColor = mix(color1, color2, n1);
        finalColor = mix(finalColor, color3, n2 * 0.7);
        
        // Add some glow and depth
        float glow = pow(1.0 - length(uv - 0.5) * 1.4, 2.0);
        finalColor += glow * 0.3;
        
        // Enhance with mouse interaction
        finalColor += mouseEffect * 0.2;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      return;
    }

    // Set up geometry
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const resolutionLocation = gl.getUniformLocation(program, 'resolution');
    const timeLocation = gl.getUniformLocation(program, 'time');
    const mouseLocation = gl.getUniformLocation(program, 'mouse');
    const colorsLocation = gl.getUniformLocation(program, 'colors');
    const mouseForceLocation = gl.getUniformLocation(program, 'mouseForce');
    const cursorSizeLocation = gl.getUniformLocation(program, 'cursorSize');

    let mouseX = 0;
    let mouseY = 0;
    let animationId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = rect.height - (e.clientY - rect.top);
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = (time: number) => {
      gl.useProgram(program);
      
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, time * 0.001);
      gl.uniform2f(mouseLocation, mouseX * window.devicePixelRatio, mouseY * window.devicePixelRatio);
      gl.uniform1f(mouseForceLocation, mouseForce);
      gl.uniform1f(cursorSizeLocation, cursorSize);
      
      // Convert hex colors to RGB
      const rgbColors = colors.map(color => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        return [r, g, b];
      }).flat();
      
      gl.uniform3fv(colorsLocation, rgbColors);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      
      animationId = requestAnimationFrame(render);
    };

    render(0);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [colors, mouseForce, cursorSize]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
        ...style
      }}
    />
  );
};

export default LiquidEther;
