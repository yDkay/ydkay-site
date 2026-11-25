// A Schwarzschild black hole, ray-traced in a fragment shader, then given a
// camera-like glow (bloom) in three small extra passes.
// Units: the Schwarzschild radius rs = 1. Light is bent with the
// pseudo-Newtonian form of the null geodesic: a = -1.5 h^2 r / |r|^5.
// Look: the choices made for the film renders of a black hole with a thin
// disk seen almost edge-on, with Doppler beaming left out so both sides of
// the disk are equally bright.
(function () {
  'use strict';

  var PRECISION = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  var VERT = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';

  var SCENE = PRECISION + [
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
    '    if(h>.95){',
    '      vec3 o=vec3(hash13(id+1.3),hash13(id+2.7),hash13(id+5.1))-.5;',
    '      float dd=length(f-o*.6);',
    '      float b=(1.-smoothstep(0.,.12,dd))*(h-.95)/.05;',
    '      vec3 tint=mix(vec3(1.,.88,.76),vec3(.8,.87,1.),hash13(id+9.));',
    '      col+=tint*b*(L==0?1.1:.6);',
    '    }',
    '  }',
    '  return col;',
    '}',

    // Thin disk, no Doppler beaming: brightness depends only on radius.
    'vec3 disk(vec3 p,out float a){',
    '  float r=length(p.xz);',
    '  a=0.;',
    '  if(r<2.4||r>18.)return vec3(0.);',
    '  float w=uTime*.35/pow(r,1.5);',
    '  float cw=cos(w),sw=sin(w);',
    '  vec2 q=vec2(p.x*cw-p.z*sw,p.x*sw+p.z*cw);',
    '  float n=noise2(q*.9)*.6+noise2(q*2.6)*.4;',
    '  float fine=.5+.5*sin(r*30.+n*7.);',
    '  float streak=.78+.22*fine*(.5+.5*n);',
    '  float edge=smoothstep(2.4,3.1,r)*(1.-smoothstep(10.,18.,r));',
    '  float k=3./r;',
    '  vec3 white=vec3(1.,.96,.9),gold=vec3(1.,.74,.42),amber=vec3(.78,.36,.12);',
    '  vec3 c=mix(amber,gold,smoothstep(.2,.55,k));',
    '  c=mix(c,white,smoothstep(.55,1.05,k));',
    '  float I=pow(k,1.05)*edge*streak*2.3;',
    '  a=clamp(edge*(.55+.4*n)*min(1.,k*2.),0.,1.);',
    '  return c*I;',
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
    '  for(int i=0;i<220;i++){',
    '    float r=length(pos);',
    // Smaller steps near the photon sphere keep the thin photon ring sharp.
    '    float dt=clamp(.06*r*smoothstep(1.,4.,r)+.008,.008,2.5);',
    '    v+=-1.5*h2*pos/pow(r,5.)*dt;',
    '    vec3 np=pos+v*dt;',
    '    if(pos.y*np.y<0.){',
    '      vec3 pc=mix(pos,np,pos.y/(pos.y-np.y));',
    '      float a;vec3 dc=disk(pc,a);',
    '      col+=(1.-al)*dc;al+=(1.-al)*a;',
    '      if(al>.985)break;',
    '    }',
    // A thin glowing layer around the plane: rays that graze the disk travel
    // through more of it, which gives the bright band across the front.
    '    float rr=length(pos.xz);',
    '    if(abs(pos.y)<1.2&&rr>2.4&&rr<18.){',
    '      float H=.22+.025*rr;',
    '      float dens=exp(-pos.y*pos.y/(H*H));',
    '      float ga;vec3 gc=disk(vec3(pos.x,0.,pos.z),ga);',
    '      float near=clamp((uDist-5.)/15.,.15,1.);',
    '      col+=(1.-al)*gc*dens*dt*1.1*near;',
    '      al+=(1.-al)*min(1.,ga*dens*dt*.6*near);',
    '      if(al>.985)break;',
    '    }',
    '    pos=np;',
    '    float nr=length(pos);',
    '    if(nr<1.)break;',
    '    if(nr>70.&&dot(pos,v)>0.){esc=true;break;}',
    '  }',
    '  if(esc)col+=(1.-al)*stars(normalize(v));',
    '  col=1.-exp(-col*1.15);',
    '  gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  // Keeps only the bright parts, at a quarter of the size.
  var BRIGHT = PRECISION + [
    'uniform sampler2D uTex;uniform vec2 uTexel;varying vec2 vUv;',
    'void main(){',
    '  vec3 c=texture2D(uTex,vUv+uTexel*vec2(-1.,-1.)).rgb+texture2D(uTex,vUv+uTexel*vec2(1.,-1.)).rgb',
    '        +texture2D(uTex,vUv+uTexel*vec2(-1.,1.)).rgb+texture2D(uTex,vUv+uTexel*vec2(1.,1.)).rgb;',
    '  c*=.25;',
    '  float l=dot(c,vec3(.2126,.7152,.0722));',
    '  gl_FragColor=vec4(c*smoothstep(.5,.95,l),1.);',
    '}'
  ].join('\n');

  // Separable Gaussian, five taps using linear filtering.
  var BLUR = PRECISION + [
    'uniform sampler2D uTex;uniform vec2 uDir;varying vec2 vUv;',
    'void main(){',
    '  vec3 c=texture2D(uTex,vUv).rgb*.227;',
    '  c+=(texture2D(uTex,vUv+uDir*1.385).rgb+texture2D(uTex,vUv-uDir*1.385).rgb)*.316;',
    '  c+=(texture2D(uTex,vUv+uDir*3.231).rgb+texture2D(uTex,vUv-uDir*3.231).rgb)*.07;',
    '  gl_FragColor=vec4(c,1.);',
    '}'
  ].join('\n');

  var COMPOSITE = PRECISION + [
    'uniform sampler2D uScene;uniform sampler2D uBloom;uniform float uTime;uniform vec2 uRes;varying vec2 vUv;',
    'float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}',
    'void main(){',
    '  vec3 c=texture2D(uScene,vUv).rgb;',
    '  vec3 b=texture2D(uBloom,vUv).rgb;',
    '  c+=b*vec3(1.,.82,.62)*.7;',
    '  c=1.-exp(-c*1.25);',
    '  float g=hash12(vUv*uRes+fract(uTime)*91.7)-.5;',
    '  c+=g*.018;',
    '  gl_FragColor=vec4(max(c,0.),1.);',
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

  function program(gl, frag, names) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link failed');
    var u = {};
    names.forEach(function (n) { u[n] = gl.getUniformLocation(p, n); });
    return { p: p, u: u };
  }

  function target(gl, w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: tex, fb: fb, w: w, h: h };
  }

  function dropTarget(gl, t) {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fb);
  }

  function BlackHole(canvas) {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false }) ||
             canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('no webgl');

    this.scene = program(gl, SCENE, ['uRes', 'uTime', 'uDist', 'uTilt', 'uYaw', 'uShift', 'uZoom']);
    this.bright = program(gl, BRIGHT, ['uTex', 'uTexel']);
    this.blur = program(gl, BLUR, ['uTex', 'uDir']);
    this.comp = program(gl, COMPOSITE, ['uScene', 'uBloom', 'uTime', 'uRes']);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.gl = gl;
    this.canvas = canvas;
    var small = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.scale = small ? 0.5 : 0.7;
    this.minScale = 0.35;
    this.maxScale = Math.min(window.devicePixelRatio || 1, 1.25);
    this.frameTimes = [];
    this.dirty = true;
    this.t = {};
  }

  BlackHole.prototype.resize = function () {
    this.dirty = false;
    var gl = this.gl, c = this.canvas;
    var w = Math.max(4, Math.round(c.clientWidth * this.scale));
    var h = Math.max(4, Math.round(c.clientHeight * this.scale));
    if (c.width === w && c.height === h && this.t.scene) return;
    c.width = w;
    c.height = h;
    var bw = Math.max(2, Math.round(w / 4)), bh = Math.max(2, Math.round(h / 4));
    ['scene', 'a', 'b'].forEach(function (k) { dropTarget(gl, this.t[k]); }, this);
    this.t.scene = target(gl, w, h);
    this.t.a = target(gl, bw, bh);
    this.t.b = target(gl, bw, bh);
  };

  BlackHole.prototype.pass = function (prog, dst) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null);
    gl.viewport(0, 0, dst ? dst.w : this.canvas.width, dst ? dst.h : this.canvas.height);
    gl.useProgram(prog.p);
  };

  BlackHole.prototype.draw = function (s) {
    var gl = this.gl, t;
    if (this.dirty) this.resize();
    t = this.t;

    var S = this.scene;
    this.pass(S, t.scene);
    gl.uniform2f(S.u.uRes, t.scene.w, t.scene.h);
    gl.uniform1f(S.u.uTime, s.time);
    gl.uniform1f(S.u.uDist, s.dist);
    gl.uniform1f(S.u.uTilt, s.tilt);
    gl.uniform1f(S.u.uYaw, s.yaw);
    gl.uniform2f(S.u.uShift, s.shiftX, s.shiftY);
    gl.uniform1f(S.u.uZoom, s.zoom);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.activeTexture(gl.TEXTURE0);

    this.pass(this.bright, t.a);
    gl.bindTexture(gl.TEXTURE_2D, t.scene.tex);
    gl.uniform1i(this.bright.u.uTex, 0);
    gl.uniform2f(this.bright.u.uTexel, 1 / t.scene.w, 1 / t.scene.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Two rounds of horizontal then vertical blur, the second one wider.
    var B = this.blur;
    for (var i = 0; i < 2; i++) {
      var spread = i === 0 ? 1 : 2.2;
      this.pass(B, t.b);
      gl.bindTexture(gl.TEXTURE_2D, t.a.tex);
      gl.uniform1i(B.u.uTex, 0);
      gl.uniform2f(B.u.uDir, spread / t.a.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.pass(B, t.a);
      gl.bindTexture(gl.TEXTURE_2D, t.b.tex);
      gl.uniform2f(B.u.uDir, 0, spread / t.a.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var C = this.comp;
    this.pass(C, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.scene.tex);
    gl.uniform1i(C.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, t.a.tex);
    gl.uniform1i(C.u.uBloom, 1);
    gl.uniform1f(C.u.uTime, s.time);
    gl.uniform2f(C.u.uRes, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  };

  // Called with the time between two drawn frames. The loop aims at about
  // 30 frames a second, so intervals well above 33 ms mean the GPU is behind.
  BlackHole.prototype.adapt = function (interval) {
    var f = this.frameTimes;
    if (interval > 250) { f.length = 0; return; }
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
