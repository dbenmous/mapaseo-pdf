export type Tool = 'select' | 'highlight' | 'draw' | 'text' | 'rectangle' | 'note' | 'signature';
export type Point = { x: number; y: number };
export type Annotation = {
  id: string; page: number; type: Exclude<Tool, 'select'>; color: string;
  x: number; y: number; width: number; height: number;
  text?: string; points?: Point[]; fontSize?: number; createdAt: number;
};
export type PageText = { page: number; text: string };
export type ChatMessage = { role: 'user' | 'assistant'; content: string; sources?: number[] };
export type OpenFile = { name: string; data: Uint8Array; path?: string };
export type RecentFile = { name: string; path: string; openedAt: number };
export type FormField = { name: string; type: 'text' | 'checkbox' | 'dropdown'; value: string | boolean; options?: string[] };
export interface DesktopAPI {
  platform: string;
  openFiles: () => Promise<OpenFile[]>;
  saveFile: (name: string, data: Uint8Array, path?: string) => Promise<string | null>;
  openRecent: (path: string) => Promise<OpenFile | null>;
  getRecent: () => Promise<RecentFile[]>;
  print: (data: Uint8Array) => Promise<void>;
  windowControl: (action: 'minimize' | 'maximize' | 'close') => void;
  onOpenFile: (callback: (file: OpenFile) => void) => () => void;
  onMenuAction: (callback: (action: string) => void) => () => void;
  aiModels: () => Promise<string[]>;
  aiChat: (model: string, question: string, context: string) => Promise<string>;
}
declare global { interface Window { desktop?: DesktopAPI } }
