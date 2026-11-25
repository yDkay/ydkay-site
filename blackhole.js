// A Schwarzschild black hole, ray-traced in a fragment shader, then given a
// camera-like glow (bloom) in three small extra passes.
// Units: the Schwarzschild radius rs = 1. Light is bent with the
// pseudo-Newtonian form of the null geodesic: a = -1.5 h^2 r / |r|^5.
// Look: a turbulent disk coloured by temperature, seen almost edge-on
// through a long lens, with the camera rolled so the disk sits at a slant.
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
    'uniform float uRoll;',
    'uniform vec2 uShift;',
    'uniform float uZoom;',
    'uniform float uExpo;',

    'float hash13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}',
    'float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}',

    'vec3 stars(vec3 d){',
    '  vec3 col=vec3(0.);',
    '  for(int L=0;L<2;L++){',
    '    float sc=L==0?70.:150.;',
    '    vec3 p=d*sc;vec3 id=floor(p);vec3 f=fract(p)-.5;',
    '    float h=hash13(id+float(L)*17.);',
    '    if(h>.965){',
    '      vec3 o=vec3(hash13(id+1.3),hash13(id+2.7),hash13(id+5.1))-.5;',
    '      float dd=length(f-o*.6);',
    '      float b=(1.-smoothstep(0.,.11,dd))*(h-.965)/.035;',
    '      vec3 tint=mix(vec3(1.,.88,.76),vec3(.8,.87,1.),hash13(id+9.));',
    '      col+=tint*b*(L==0?.8:.45);',
    '    }',
    '  }',
    '  return col;',
    '}',

    // Noise made of rings. Each ring turns as one piece at its own orbital
    // speed, so the pattern never winds itself up, however long the page is open.
    'float ringRow(float i,float th,float N,float fr,float seed){',
    '  float rr=(i+.5)/fr;',
    '  float w=uTime*.28/pow(max(rr,2.),1.5);',
    '  float u=(th+w)*N/6.2831853;',
    '  float j=floor(u);float g=fract(u);g=g*g*(3.-2.*g);',
    '  return mix(hash12(vec2(i+seed,mod(j,N))),hash12(vec2(i+seed,mod(j+1.,N))),g);',
    '}',
    'float ringNoise(float r,float th,float fr,float N,float seed){',
    '  float x=r*fr;float i=floor(x);float f=fract(x);f=f*f*(3.-2.*f);',
    '  return mix(ringRow(i,th,N,fr,seed),ringRow(i+1.,th,N,fr,seed),f);',
    '}',

    // Colour by temperature: dark rust, orange, gold, then white-hot.
    'vec3 heat(float t){',
    '  vec3 c=mix(vec3(.15,.028,.008),vec3(.55,.14,.03),smoothstep(.01,.09,t));',
    '  c=mix(c,vec3(1.,.46,.14),smoothstep(.08,.24,t));',
    '  c=mix(c,vec3(1.,.74,.45),smoothstep(.2,.5,t));',
    '  return mix(c,vec3(1.,.96,.9),smoothstep(.42,.95,t));',
    '}',

    'vec3 disk(vec3 p,vec3 v,float seed,out float a){',
    '  float r=length(p.xz);',
    '  a=0.;',
    '  if(r<2.9||r>15.)return vec3(0.);',
    '  float th=atan(p.z,p.x);',
    '  float n1=ringNoise(r,th,1.1,7.,seed);',
    '  float n2=ringNoise(r,th,3.6,34.,seed+31.);',
    '  float n3=ringNoise(r,th,10.,120.,seed+67.);',
    '  float n4=ringNoise(r,th,26.,380.,seed+113.);',
    '  float turb=n1*.34+n2*.3+n3*.22+n4*.14;',
    '  float lanes=smoothstep(.3,.62,n2*.55+n3*.45);',
    '  float grain=.6+.9*n4*(.4+.6*n3);',
    '  float inner=smoothstep(2.9,3.9,r);',
    '  float outer=1.-smoothstep(6.,15.,r);',
    '  float k=3./r;',
    '  vec3 tang=normalize(vec3(-p.z,0.,p.x));',
    '  float s=sqrt(.5/(r-1.))*.5;',
    '  float D=sqrt(1.-s*s)/(1.-s*dot(tang,-normalize(v)));',
    '  float boost=D*D*D;',
    '  float temp=pow(k,1.75)*(.3+1.5*turb)*boost*1.15;',
    '  float body=inner*outer*(.2+.8*lanes);',
    '  a=clamp(body*(.45+.7*turb)*min(1.,k*2.4),0.,1.);',
    '  return heat(temp)*pow(temp,.8)*body*grain*3.6;',
    '}',

    'void main(){',
    '  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y-uShift;',
    '  float cr=cos(uRoll),sr=sin(uRoll);',
    '  uv=vec2(uv.x*cr-uv.y*sr,uv.x*sr+uv.y*cr);',
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
    '  for(int i=0;i<230;i++){',
    '    float r=length(pos);',
    // Smaller steps near the photon sphere keep the thin photon ring sharp.
    '    float dt=clamp(.06*r*smoothstep(1.,4.,r)+.008,.008,2.5);',
    '    v+=-1.5*h2*pos/pow(r,5.)*dt;',
    '    vec3 np=pos+v*dt;',
    // Three thin sheets (the plane and one just above and below it) give the
    // disk some depth when it is seen almost edge-on.
    '    float r0=length(pos.xz),r1=length(np.xz);',
    '    for(int k=0;k<3;k++){',
    '      float c=(float(k)-1.)*.03;',
    '      float f0=pos.y-c*r0,f1=np.y-c*r1;',
    '      if(f0*f1<0.){',
    '        vec3 pc=mix(pos,np,f0/(f0-f1));',
    '        float a;vec3 dc=disk(pc,v,float(k)*7.,a);',
    '        float wgt=k==1?1.:.55;',
    '        col+=(1.-al)*dc*wgt;al+=(1.-al)*a*wgt;',
    '      }',
    '    }',
    '    if(al>.985)break;',
    '    pos=np;',
    '    float nr=length(pos);',
    '    if(nr<1.)break;',
    '    if(nr>70.&&dot(pos,v)>0.){esc=true;break;}',
    '  }',
    '  if(esc)col+=(1.-al)*stars(normalize(v));',
    '  col*=uExpo;',
    '  col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);',
    '  float lum=dot(col,vec3(.2126,.7152,.0722));',
    '  col=clamp(mix(vec3(lum),col,1.08),0.,1.);',
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
    '  gl_FragColor=vec4(c*smoothstep(.6,1.,l),1.);',
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
    '  c=1.-(1.-c)*(1.-clamp(b*vec3(1.,.6,.32)*.75,0.,1.));',
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

    this.scene = program(gl, SCENE, ['uRes', 'uTime', 'uDist', 'uTilt', 'uYaw', 'uRoll', 'uShift', 'uZoom', 'uExpo']);
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
    gl.uniform1f(S.u.uRoll, s.roll || 0);
    gl.uniform2f(S.u.uShift, s.shiftX, s.shiftY);
    gl.uniform1f(S.u.uZoom, s.zoom);
    gl.uniform1f(S.u.uExpo, s.expo || 1);
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
