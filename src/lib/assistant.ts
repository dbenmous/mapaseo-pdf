import type { PageText } from '../types';

const STOP = new Set('a an the is are was were be been being to of in on and or for as with this that these those it its at by from into about can could should would will what which who how why when where do does did has have had me my our your their tell please document pdf page pages give explain find show'.split(' '));
const terms = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(t => t.length > 1 && !STOP.has(t)) || [];
const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
function sentences(text: string): string[] {
  // Keep meaningful punctuation and original phrasing for verifiable quotations.
  return clean(text).match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)?.map(s => s.trim()).filter(s => s.length >= 32) || [];
}

/** Private, deterministic extraction from the current document. No model/network. */
export function localAnswer(question: string, pages: PageText[]): { content: string; sources: number[] } {
  const available = pages.filter(p => p.text.trim());
  if (!available.length) return {
    content: 'There is no searchable text in this document yet. This may be a scanned PDF. Local document search cannot read text inside page images.', sources: [],
  };
  const tokens = [...new Set(terms(question))];
  const requestedPage = question.match(/\bpage\s+(\d+)\b/i)?.[1];
  const isSummary = /\b(summar(?:y|ize|ise)|overview|key\s+(?:points|takeaways|ideas)|main\s+(?:points|ideas)|tl;?dr)\b/i.test(question)
    || (!!requestedPage && !tokens.length);
  const isAction = /\b(recommendations?|next steps|action items?|act on)\b/i.test(question);
  if (!tokens.length && !isSummary && !isAction) return {
    content: 'Ask about a specific topic in the document, or choose a summary or key points. Local document search returns excerpts from the text and page references.', sources: [],
  };
  const scoped = requestedPage ? available.filter(p => p.page === Number(requestedPage)) : available;
  if (!scoped.length) return { content: `Page ${requestedPage} has no searchable text or does not exist.`, sources: [] };
  const rows = scoped.flatMap(p => {
    const parts = sentences(p.text);
    return (parts.length ? parts : [clean(p.text)]).map((text, index) => ({ text, page: p.page, index, words: terms(text) }));
  });
  const frequency = new Map<string, number>();
  rows.forEach(r => new Set(r.words).forEach(w => frequency.set(w, (frequency.get(w) || 0) + 1)));
  const ranked = rows.map(row => {
    const set = new Set(row.words);
    const matches = tokens.filter(token => set.has(token) || [...set].some(w => token.length > 4 && w.startsWith(token.slice(0, -1))));
    const relevance = matches.reduce((n, token) => n + 1 + Math.log((rows.length + 1) / ((frequency.get(token) || 0) + 1)), 0);
    const centrality = [...set].reduce((n, w) => n + Math.min(frequency.get(w) || 0, 8), 0) / Math.sqrt(Math.max(row.words.length, 1));
    const action = /\b(start|begin|choose|create|provide|use|make|give|assign|review|keep|test|listen|measure|ask|place|reduce|add)\b/i.test(row.text);
    return { ...row, score: isSummary ? centrality + (row.index === 0 ? 1.5 : 0)
      : relevance + (isAction && action ? 3 + centrality * 0.15 : 0), matches: matches.length, action };
  }).filter(r => isSummary || r.matches > 0 || (isAction && r.action)).sort((a, b) => b.score - a.score || a.page - b.page || a.index - b.index);
  if (!ranked.length) return { content: 'I could not find a matching passage in the document text. Try a phrase used in the PDF or ask for key points. This local search cannot infer an answer that the document does not contain.', sources: [] };
  const selected: typeof ranked = [];
  const seen = new Set<string>();
  // For an overview, first pick a useful excerpt from distinct pages.
  if (isSummary) {
    const overviewPages = [...new Set(ranked.map(row => row.page))];
    for (const page of overviewPages) {
      const row = ranked.find(r => r.page === page && !seen.has(r.text.toLowerCase()));
      if (row) { selected.push(row); seen.add(row.text.toLowerCase()); }
      if (selected.length >= 5) break;
    }
  } else for (const row of ranked) {
    const key = row.text.toLowerCase();
    if (seen.has(key)) continue;
    selected.push(row); seen.add(key);
    if (selected.length >= 3) break;
  }
  selected.sort((a, b) => a.page - b.page || a.index - b.index);
  const excerpts = selected.map(r => {
    const excerpt = r.text.length > 600 ? `${r.text.slice(0, 597).replace(/\s+\S*$/, '')}...` : r.text;
    return `- "${excerpt}" (page ${r.page})`;
  }).join('\n\n');
  return {
    content: `${isSummary ? 'Key excerpts from the document' : isAction ? 'Action-oriented excerpts from the document' : 'Relevant passages from the document'}:\n\n${excerpts}\n\nExtractive local search: these are document excerpts, not a generated interpretation.`,
    sources: [...new Set(selected.map(r => r.page))],
  };
}
