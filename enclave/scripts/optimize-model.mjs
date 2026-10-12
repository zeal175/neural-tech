// Compress the Blender export for the web: dedup/prune/weld, then meshopt (quantize + reorder +
// EXT_meshopt_compression). Usage: npm run model
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { statSync } from "node:fs";

const SRC = "blender/export/enclave_bust_raw.glb";
const OUT = "public/models/enclave-bust.glb";

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

const doc = await io.read(SRC);
// keepAttributes: textures are bound at runtime, so prune() would otherwise strip UVs/tangents.
await doc.transform(
  dedup(),
  prune({ keepAttributes: true }),
  weld(),
  meshopt({ encoder: MeshoptEncoder, level: "high" })
);
await io.write(OUT, doc);

const kb = (p) => Math.round(statSync(p).size / 1024);
const meshes = doc
  .getRoot()
  .listMeshes()
  .map((m) => {
    const prim = m.listPrimitives()[0];
    const attrs = prim.listSemantics().join(",");
    return `${m.getName()}: ${prim.getAttribute("POSITION").getCount()} verts, ${prim.getIndices().getCount() / 3} tris [${attrs}]`;
  });
console.log(`${SRC} ${kb(SRC)} KB -> ${OUT} ${kb(OUT)} KB`);
console.log(meshes.join("\n"));
