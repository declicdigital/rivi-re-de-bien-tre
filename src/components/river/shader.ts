export const vert = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
export const frag = `precision highp float;
uniform vec2 uRes;uniform float uTime;uniform float uOffset;uniform float uDpr;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float hgt(vec2 p){vec2 q=p;q.x-=uTime*.22;
 float h=fbm(q*vec2(1.1,2.6));
 h+=.45*fbm(q*vec2(3.2,6.)+vec2(-uTime*.18,uTime*.04));
 return h;}
void main(){
 vec2 fc=gl_FragCoord.xy;float y=fc.y/uRes.y;
 float sc=mix(1.,2.8,y);
 vec2 p=vec2((fc.x-uRes.x*.5)/uRes.y*sc+uOffset,1.6/(1.25-y*.9));
 float e=.03;float h=hgt(p);
 vec3 n=normalize(vec3((h-hgt(p+vec2(e,0.)))*1.1,(h-hgt(p+vec2(0.,e)))*1.1,e*6.));
 vec3 deep=vec3(.015,.16,.30),mid=vec3(.04,.36,.50),shal=vec3(.18,.62,.62);
 float edge=smoothstep(.0,.18,y)*smoothstep(1.,.78,y);
 vec3 col=mix(shal,mix(mid,deep,smoothstep(.3,.6,edge+h*.3)),edge);
 // caustics
 vec2 cp=p*3.5+vec2(-uTime*.35,0.);
 float c=1.-abs(noise(cp)-.5)*2.;c*=1.-abs(noise(cp*1.7+3.1+uTime*.1)-.5)*2.;
 col+=vec3(.35,.7,.7)*pow(c,6.)*.35*(1.-y*.6);
 // sky reflection & fresnel
 vec3 v=normalize(vec3(0.,-.7+y*.5,1.));
 float fr=pow(1.-max(dot(n,v),0.),3.);
 col=mix(col,vec3(.72,.86,.92),fr*.35+y*.12);
 vec3 l=normalize(vec3(-.3,.6,.75));vec3 r=reflect(-l,n);
 float s=pow(max(dot(r,v),0.),90.);
 col+=vec3(1.,.97,.9)*s*.7;
 col+=vec3(.9,.95,1.)*pow(max(n.x*.5+n.y*.5,0.),4.)*.25;
 gl_FragColor=vec4(col,1.);}`;
