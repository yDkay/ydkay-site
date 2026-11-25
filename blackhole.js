// A Schwarzschild black hole, ray-traced in a fragment shader.
// Units: the Schwarzschild radius rs = 1. Light is bent with the
// pseudo-Newtonian form of the null geodesic: a = -1.5 h^2 r / |r|^5.
(function () {
  'use strict';

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH','precision highp float;','#else','precision mediump float;','#endif',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform float uDist;',
    'uniform float uTilt;',
    'uniform float uYaw;',
    'uniform vec2 uShift;',
    'uniform float uZoom;',

    'float hash13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}',
    'float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}',
    'float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    '  float a=hash12(i),b=hash12(i+vec2(1.,0.)),c=hash12(i+vec2(0.,1.)),d=hash12(i+vec2(1.,1.));',
    '  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',

    'vec3 stars(vec3 d){',
    '  vec3 col=vec3(0.);',
    '  for(int L=0;L<2;L++){',
    '    float sc=L==0?55.:130.;',
    '    vec3 p=d*sc;vec3 id=floor(p);vec3 f=fract(p)-.5;',
    '    float h=hash13(id+float(L)*17.);',
    '    if(h>.94){',
    '      vec3 o=vec3(hash13(id+1.3),hash13(id+2.7),hash13(id+5.1))-.5;',
    '      float dd=length(f-o*.6);',
    '      float b=(1.-smoothstep(0.,.13,dd))*(h-.94)/.06;',
    '      vec3 tint=mix(vec3(1.,.86,.72),vec3(.74,.84,1.),hash13(id+9.));',
    '      col+=tint*b*(L==0?1.25:.7);',
    '    }',
    '  }',
    '  float bx=dot(d,normalize(vec3(.35,1.,.18)))*3.2;','  float band=exp(-bx*bx);',
    '  col+=vec3(.045,.04,.055)*band*(.35+.65*noise2(d.xz*9.+d.y*4.));',
    '  return col;',
    '}',

    'vec3 disk(vec3 p,vec3 v,out float a){',
    '  float r=length(p.xz);',
    '  a=0.;',
    '  if(r<2.6||r>12.)return vec3(0.);',
    '  float w=uTime*.55/pow(r,1.5);',
    '  float cw=cos(w),sw=sin(w);',
    '  vec2 q=vec2(p.x*cw-p.z*sw,p.x*sw+p.z*cw);',
    '  float n=noise2(q*1.3)*.55+noise2(q*3.7)*.3+noise2(q*9.)*.15;',
    '  float rings=.55+.45*sin(r*8.5+n*5.);',
    '  float edge=smoothstep(2.6,3.4,r)*(1.-smoothstep(7.,12.,r));',
    '  float temp=pow(3./r,1.5);',
    '  vec3 tang=normalize(vec3(-p.z,0.,p.x));',
    '  float s=sqrt(.5/(r-1.));',
    '  float g=sqrt(1.-s*s);',
    '  float D=g/(1.-s*dot(tang,-normalize(v)));',
    '  float boost=clamp(D*D*D,.08,6.);',
    '  vec3 hot=vec3(1.,.94,.84),warm=vec3(1.,.56,.24),deep=vec3(.5,.11,.04);',
    '  vec3 c=mix(deep,warm,smoothstep(.12,.55,temp));',
    '  c=mix(c,hot,smoothstep(.6,1.1,temp*boost*.8));',
    '  float I=temp*edge*(.35+.8*n*rings)*boost;',
    '  a=clamp(edge*(.3+.55*n*rings)*min(1.,temp*2.4),0.,1.);',
    '  return c*I*1.9;',
    '}',

    'void main(){',
    '  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y-uShift;',
    '  float cy=cos(uYaw),sy=sin(uYaw);',
    '  vec3 cam=vec3(0.,sin(uTilt),cos(uTilt))*uDist;',
    '  cam=vec3(cam.x*cy+cam.z*sy,cam.y,-cam.x*sy+cam.z*cy);',
    '  vec3 fw=normalize(-cam);',
    '  vec3 rt=normalize(cross(fw,vec3(0.,1.,0.)));',
    '  vec3 up=cross(rt,fw);',
    '  vec3 v=normalize(fw*uZoom+uv.x*rt+uv.y*up);',
    '  vec3 pos=cam;',
    '  vec3 hv=cross(pos,v);float h2=dot(hv,hv);',
    '  vec3 col=vec3(0.);float al=0.;bool esc=false;',
    '  for(int i=0;i<170;i++){',
    '    float r=length(pos);',
    '    float dt=clamp(.07*r,.012,2.5);',
    '    v+=-1.5*h2*pos/pow(r,5.)*dt;',
    '    vec3 np=pos+v*dt;',
    '    if(pos.y*np.y<0.){',
    '      vec3 pc=mix(pos,np,pos.y/(pos.y-np.y));',
    '      float a;vec3 dc=disk(pc,v,a);',
    '      col+=(1.-al)*dc;al+=(1.-al)*a;',
    '      if(al>.985)break;',
    '    }',
    '    pos=np;',
    '    float nr=length(pos);',
    '    if(nr<1.)break;',
    '    if(nr>70.&&dot(pos,v)>0.){esc=true;break;}',
    '  }',
    '  if(esc)col+=(1.-al)*stars(normalize(v));',
    '  col=1.-exp(-col*1.35);',
    '  gl_FragColor=vec4(pow(col,vec3(.95)),1.);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
    }
    return s;
  }

  function BlackHole(canvas) {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false }) ||
             canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('no webgl');
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link failed');
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var u = {};
    ['uRes', 'uTime', 'uDist', 'uTilt', 'uYaw', 'uShift', 'uZoom'].forEach(function (n) {
      u[n] = gl.getUniformLocation(prog, n);
    });

    this.gl = gl;
    this.u = u;
    this.canvas = canvas;
    // Resolution scale: starts modest and adapts to the frame time.
    var small = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.scale = small ? 0.55 : 0.75;
    this.minScale = 0.35;
    this.maxScale = Math.min(window.devicePixelRatio || 1, 1.25);
    this.frameTimes = [];
    this.dirty = true;
  }

  BlackHole.prototype.resize = function () {
    this.dirty = false;
    var c = this.canvas;
    var w = Math.max(1, Math.round(c.clientWidth * this.scale));
    var h = Math.max(1, Math.round(c.clientHeight * this.scale));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  };

  BlackHole.prototype.draw = function (s) {
    var gl = this.gl, u = this.u;
    if (this.dirty) this.resize();
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, s.time);
    gl.uniform1f(u.uDist, s.dist);
    gl.uniform1f(u.uTilt, s.tilt);
    gl.uniform1f(u.uYaw, s.yaw);
    gl.uniform2f(u.uShift, s.shiftX, s.shiftY);
    gl.uniform1f(u.uZoom, s.zoom);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Called with the time between two drawn frames. The loop aims at about
  // 30 frames a second, so intervals well above 33 ms mean the GPU is behind.
  BlackHole.prototype.adapt = function (interval) {
    var f = this.frameTimes;
    if (interval > 250) { f.length = 0; return; } // tab was hidden or stalled
    f.push(interval);
    if (f.length < 30) return;
    var avg = f.reduce(function (a, b) { return a + b; }, 0) / f.length;
    f.length = 0;
    var before = this.scale;
    if (avg > 45) this.scale = Math.max(this.minScale, this.scale * 0.85);
    else if (avg < 37) this.scale = Math.min(this.maxScale, this.scale * 1.06);
    if (this.scale !== before) this.dirty = true;
  };

  window.BlackHole = BlackHole;
})();
