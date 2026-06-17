const FORBIDDEN_ATTRS = /^on/i;
const FORBIDDEN_TAGS = new Set(["script", "iframe", "object", "embed", "form", "input", "link", "meta", "style"]);

export function sanitizeSvg(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "image/svg+xml");
    const parseErr = doc.querySelector("parsererror");
    if (parseErr) return "";
    removeForbidden(doc.documentElement);
    return doc.documentElement.outerHTML;
  } catch {
    return "";
  }
}

function removeForbidden(el: Element) {
  for (const child of [...el.children]) {
    if (FORBIDDEN_TAGS.has(child.tagName.toLowerCase())) {
      child.remove();
      continue;
    }
    removeForbidden(child);
  }
  for (const attr of [...el.attributes]) {
    if (FORBIDDEN_ATTRS.test(attr.name) || attr.name.toLowerCase() === "href" && (attr.value.trim().toLowerCase().startsWith("javascript"))) {
      el.removeAttribute(attr.name);
    }
  }
}
