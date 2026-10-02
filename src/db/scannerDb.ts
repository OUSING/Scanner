import Dexie, { type Table } from 'dexie';
import type { DocumentKind, DocumentProject, ScannedPage } from '../types/scanner';

export class ScannerDatabase extends Dexie {
  documents!: Table<DocumentProject>;

  constructor() {
    super('PaperScannerDB');
    this.version(1).stores({
      documents: 'id, title, createdAt, updatedAt',
    });
  }
}

export const db = new ScannerDatabase();

// DB Helper Utilities
export async function getAllDocuments(): Promise<DocumentProject[]> {
  return await db.documents.orderBy('updatedAt').reverse().toArray();
}

export async function getDocumentById(id: string): Promise<DocumentProject | undefined> {
  return await db.documents.get(id);
}

export async function saveDocument(doc: DocumentProject): Promise<string> {
  doc.updatedAt = Date.now();
  await db.documents.put(doc);
  return doc.id;
}

export async function deleteDocument(id: string): Promise<void> {
  await db.documents.delete(id);
}

export async function createNewDocument(title?: string, initialPages: ScannedPage[] = [], kind: DocumentKind = 'document'): Promise<DocumentProject> {
  const newDoc: DocumentProject = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    kind,
    title: title || (kind === 'id_card' ? `ID Card ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : null) || `Scan ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    pages: initialPages,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.documents.put(newDoc);
  return newDoc;
}
