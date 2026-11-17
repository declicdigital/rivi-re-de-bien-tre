// Modèles 3D embarqués dans le code (herbe, rochers, fleurs) : aucun fichier externe à charger.
import grass from "./models/grass";
import rock1 from "./models/rock1";
import rock2 from "./models/rock2";
import rock3 from "./models/rock3";
import flowerWhite from "./models/flower_white";
import flowerBlue from "./models/flower_blue";
import flowerYellow from "./models/flower_yellow";

export const MODELS = { grass, rock1, rock2, rock3, flowerWhite, flowerBlue, flowerYellow };

export function dataUrlToBuffer(url: string /* base64 */) {
  const bin = atob(url);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
