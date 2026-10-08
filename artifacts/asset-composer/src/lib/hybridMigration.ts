/** Deterministic, idempotent upgrade. Legacy referenceAsset was exported artwork. */
export function upgradeHybridProject(raw: any): any {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.entities))
    return raw;
  const project = structuredClone(raw);
  project.version = "3.0";
  project.assets ??= {};
  const idFor = (uri: string) => {
    let h = 2166136261;
    for (let i = 0; i < uri.length; i++)
      h = Math.imul(h ^ uri.charCodeAt(i), 16777619);
    return "migrated_" + (h >>> 0).toString(16) + "_" + uri.length;
  };
  const raster = (uri: string, width: number, height: number, name: string) => {
    const id = idFor(uri);
    project.assets[id] ??= {
      id,
      name,
      mimeType: uri.slice(5, uri.indexOf(";")),
      width: Math.max(1, width),
      height: Math.max(1, height),
      dataUri: uri,
    };
    return { kind: "raster", assetId: id };
  };
  const convert = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.svgData === "string" && !value.content) {
      const svg = value.svgData;
      const match =
        /^\s*<svg\b[^>]*>\s*<image\b([^>]+)\/?\s*>\s*(?:<\/image>\s*)?<\/svg>\s*$/i.exec(
          svg,
        );
      const uri =
        match &&
        /\b(?:href|xlink:href)=["'](data:image\/(?:png|webp|jpeg);base64,[^"']+)["']/i.exec(
          match[1],
        );
      const root = /^\s*<svg\b([^>]*)>/i.exec(svg)?.[1] ?? "";
      const attributes = match?.[1] ?? "";
      const number = (name: string, attrs: string) =>
        Number(
          new RegExp("\\b" + name + "=[\"']([\\d.+-]+)[\"']", "i").exec(
            attrs,
          )?.[1] ?? 0,
        );
      const viewBox = /\bviewBox=["']([^"']+)["']/i
        .exec(root)?.[1]
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const imageWidth = number("width", attributes),
        imageHeight = number("height", attributes);
      const unsafe =
        /\b(transform|opacity|clip-path|mask|filter|style)=/i.test(
          root + " " + attributes,
        ) ||
        number("x", attributes) !== 0 ||
        number("y", attributes) !== 0 ||
        !!(
          viewBox &&
          (viewBox.length !== 4 ||
            viewBox[0] !== 0 ||
            viewBox[1] !== 0 ||
            viewBox[2] !== imageWidth ||
            viewBox[3] !== imageHeight)
        ) ||
        !!(number("width", root) && number("width", root) !== imageWidth) ||
        !!(number("height", root) && number("height", root) !== imageHeight) ||
        /\bpreserveAspectRatio=["'](?!none["'])/i.test(attributes);
      if (uri && !unsafe) {
        const m = value.metrics;
        const width =
            m?.viewBoxWidth ??
            value.naturalWidth ??
            Number(/\bwidth=["']([\d.]+)["']/.exec(match![1])?.[1] ?? 1),
          height =
            m?.viewBoxHeight ??
            value.naturalHeight ??
            Number(/\bheight=["']([\d.]+)["']/.exec(match![1])?.[1] ?? 1);
        value.content = raster(
          uri[1],
          width,
          height,
          value.id ?? "Imported raster",
        );
        delete value.svgData;
      } else value.content = { kind: "vector", svgData: svg };
    }
    for (const [key, child] of Object.entries(value)) {
      if (
        key === "content" ||
        key === "assets" ||
        key === "source" ||
        key === "referenceAsset" ||
        key === "tracingAsset"
      )
        continue;
      if (Array.isArray(child)) child.forEach(convert);
      else if (child && typeof child === "object") convert(child);
    }
  };
  convert(project);
  for (const doc of project.editorMeta?.spriteEditorDocuments ?? []) {
    doc.layers ??= [];
    doc.layers.forEach((l: any) => {
      l.kind ??= "vector";
    });
    if (doc.referenceAsset?.dataUri) {
      const ref = doc.referenceAsset,
        uri = ref.dataUri;
      if (/^data:image\/(png|webp|jpeg);/.test(uri))
        doc.layers.unshift({
          id: doc.id + "__legacy_art",
          name: ref.name ?? "Imported artwork",
          kind: "raster",
          assetId: raster(uri, doc.width, doc.height, ref.name).assetId,
          visible: true,
          opacity: 0.9,
          zIndex: Math.min(0, ...doc.layers.map((l: any) => l.zIndex)) - 1,
          shapes: [],
        });
      else {
        // Keep unsupported SVG as genuine vector art, including its exact source.
        const data = uri.slice(uri.indexOf(",") + 1);
        const svg = uri.includes(";base64,")
          ? new TextDecoder().decode(
              Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
            )
          : decodeURIComponent(data);
        doc.layers.unshift({
          id: doc.id + "__legacy_art",
          name: ref.name ?? "Imported artwork",
          kind: "vector",
          visible: true,
          opacity: 0.9,
          zIndex: -1,
          shapes: [],
          sourceSvg: svg,
        });
      }
      doc.referenceAsset = null;
    }
  }
  return project;
}
