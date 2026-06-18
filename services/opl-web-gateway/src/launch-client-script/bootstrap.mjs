export function joinScriptSections(sections) {
  return sections.filter(Boolean).join("\n\n");
}

export function buildScriptTemplate(sections) {
  return `\n${joinScriptSections(sections)}\n`;
}
