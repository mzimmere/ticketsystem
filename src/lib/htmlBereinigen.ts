const ENTFERNEN = ["script", "iframe", "frame", "frameset", "object", "embed", "form", "base", "meta", "link"];
const URL_ATTRIBUTE = ["href", "src", "action", "xlink:href", "formaction", "background"];

// Entfernt aktive Inhalte (Skripte, Frames, Event-Handler, javascript:-Links)
// aus selbst geschriebenem Mail-HTML. Mailclients ignorieren das ohnehin,
// aber die Vorschau und das Ticket sollen nie etwas ausfuehren.
export function htmlBereinigen(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(ENTFERNEN.join(",")).forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const wert = attr.value.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if (URL_ATTRIBUTE.includes(name) && /^(javascript|vbscript):/.test(wert)) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

const BLOCK = new Set(["DIV", "TR", "UL", "OL", "TABLE", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6"]);

// Klartext-Fassung fuer das Ticket (dort wird kein HTML dargestellt) und als
// text-Alternative der Mail: Links als "Text (URL)", Bilder als [Alt-Text].
export function htmlZuText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,head").forEach((el) => el.remove());

  function lauf(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/\s+/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const tag = el.tagName;
    if (tag === "BR") return "\n";
    if (tag === "IMG") {
      const alt = el.getAttribute("alt");
      return alt ? `[${alt}]` : "";
    }
    const innen = Array.from(el.childNodes).map(lauf).join("");
    if (tag === "A") {
      const href = el.getAttribute("href");
      const text = innen.trim();
      if (!href || text === href) return innen;
      return text ? `${text} (${href})` : href;
    }
    if (tag === "LI") return `- ${innen.trim()}\n`;
    if (tag === "P") return `${innen.trim()}\n\n`;
    if (BLOCK.has(tag)) return `${innen.trim()}\n`;
    return innen;
  }

  return lauf(doc.body).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function htmlMaskieren(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
