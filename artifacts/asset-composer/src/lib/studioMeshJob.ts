import type { Bone, Matrix2D, VisualMesh } from "@/domain/types";
import type { EvaluatedSkeleton } from "./evaluationPipeline";
import { worldBoneToMatrix } from "./matrixUtils";
import { autoMesh, autoWeights } from "./studioMesh";
export interface MeshJob {
  matrices?: Record<string, Matrix2D>;
  pixels?: Uint8ClampedArray;
  width: number;
  height: number;
  setup: Matrix2D;
  quality: VisualMesh["quality"];
  mesh?: VisualMesh;
  bones: Bone[];
  skeleton: EvaluatedSkeleton;
  influences: string[];
  weights: boolean;
}
export function executeMeshJob(job: MeshJob): VisualMesh {
  const mesh = job.pixels
    ? autoMesh(job.pixels, job.width, job.height, job.setup, job.quality)
    : job.mesh;
  if (!mesh) throw new Error("Нет сетки или рисунка. Выберите непустой слой.");
  return job.weights
    ? autoWeights(mesh, job.bones, job.skeleton, job.influences, job.matrices)
    : mesh;
}
export function runMeshJob(job: MeshJob): Promise<VisualMesh> {
  if (typeof Worker === "undefined")
    return Promise.resolve(executeMeshJob(job));
  job = {
    ...job,
    matrices: Object.fromEntries(
      [...job.skeleton.bones].map(([id, b]) => [id, worldBoneToMatrix(b)]),
    ),
  };
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./studioMesh.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.mesh);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage(
      job,
      job.pixels ? [job.pixels.buffer as ArrayBuffer] : [],
    );
  });
}
