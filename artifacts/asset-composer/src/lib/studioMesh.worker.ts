import type { MeshJob } from "./studioMeshJob";
import { autoMesh, autoWeights } from "./studioMesh";
self.onmessage = (event: MessageEvent<MeshJob>) => {
  try {
    const job = event.data;
    const mesh = job.pixels
      ? autoMesh(job.pixels, job.width, job.height, job.setup, job.quality)
      : job.mesh;
    if (!mesh) throw new Error("No mesh or artwork");
    self.postMessage({
      mesh: job.weights
        ? autoWeights(
            mesh,
            job.bones,
            job.skeleton,
            job.influences,
            job.matrices,
          )
        : mesh,
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
