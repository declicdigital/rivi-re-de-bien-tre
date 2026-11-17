import * as THREE from "three";

export const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float simplex2d(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.0*dot(m,g);}
`;

export type TimeUniform = { value: number };

/** Ajoute un balancement au vent (herbe, roseaux, fleurs). heightScale : hauteur de référence du modèle. */
export function addWind(
  material: THREE.Material,
  time: TimeUniform,
  opts: { strength?: number; heightScale?: number; instanced?: boolean } = {},
) {
  const strength = opts.strength ?? 0.25;
  const hs = opts.heightScale ?? 1;
  const instanced = opts.instanced ?? true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms["uTime"] = time;
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", `uniform float uTime;\n${SIMPLEX}\nvoid main() {`)
      .replace(
        "#include <project_vertex>",
        `
        vec4 mvPosition = vec4(transformed, 1.0);
        ${instanced ? "mvPosition = instanceMatrix * mvPosition;" : ""}
        vec4 wp = modelMatrix * mvPosition;
        float wo = 6.28 * simplex2d(wp.xz / 90.0);
        float gust = 0.6 + 0.4 * simplex2d(wp.xz / 220.0 + uTime * 0.05);
        float k = clamp(position.y / ${hs.toFixed(3)}, 0.0, 1.5);
        k *= k;
        vec2 sway = vec2(sin(uTime * 1.3 + wo) * cos(uTime * 1.9 + wo), 0.5 * sin(uTime * 1.1 + wo * 1.7));
        mvPosition.xz += sway * k * ${strength.toFixed(3)} * gust;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
        `,
      );
  };
  material.customProgramCacheKey = () => `wind-${strength}-${hs}-${instanced}`;
}
