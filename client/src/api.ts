import type { MagdaleneProject } from './model/project'

// MAGDALENE talks to its backend through the native IPC bridge when running in
// Electron, and falls back to HTTP for the legacy `dev:web` workflow. The rest
// of the app imports `api` and never has to know which transport is active.

type HealthResult = { ok: boolean; app?: string; version?: string }
type SaveResult = { ok: boolean; path?: string }
type ExportResult = { ok: boolean; status: string; note?: string; hasFfmpeg?: boolean; outputDir?: string }
type OpenResult = { ok: boolean; canceled?: boolean; path?: string; project?: MagdaleneProject }
type OpenAudioRaw = { ok: boolean; canceled?: boolean; path?: string; name?: string; bytes?: Uint8Array; lyrics?: string | null }
export type OpenAudioResult = { ok: boolean; canceled?: boolean; path?: string; name?: string; bytes?: ArrayBuffer; lyrics?: string | null }

export type ArchiveImage = { id: string; name: string; url: string }
export type ScanArchiveResult = {
  ok: boolean
  canceled?: boolean
  dir?: string
  total?: number
  count?: number
  images?: ArchiveImage[]
  error?: string
}
export type AnalyzeAudioResult = {
  ok: boolean
  backend: string
  note?: string
  analysis?: { controls?: unknown[]; events?: unknown[]; sections?: unknown[]; beats?: number[]; tempo?: number }
}

type MagdaleneBridge = {
  isNative: true
  health(): Promise<HealthResult>
  getDefaultProject(): Promise<MagdaleneProject>
  saveProject(name: string, project: MagdaleneProject): Promise<SaveResult>
  exportProject(project: MagdaleneProject): Promise<ExportResult>
  openProject(): Promise<OpenResult>
  openAudio(): Promise<OpenAudioRaw>
  scanArchive(): Promise<ScanArchiveResult>
  analyzeAudio(filePath: string): Promise<AnalyzeAudioResult>
}

declare global {
  interface Window {
    magdalene?: MagdaleneBridge
  }
}

const HTTP_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5178'

function bridge(): MagdaleneBridge | null {
  return typeof window !== 'undefined' && window.magdalene ? window.magdalene : null
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HTTP_BASE}${path}`, init)
  return res.json() as Promise<T>
}

export const isNative = !!bridge()

export const api = {
  async health(): Promise<HealthResult> {
    const native = bridge()
    if (native) return native.health()
    return http<HealthResult>('/api/health')
  },

  async getDefaultProject(): Promise<MagdaleneProject> {
    const native = bridge()
    if (native) return native.getDefaultProject()
    return http<MagdaleneProject>('/api/project/default')
  },

  async saveProject(name: string, project: MagdaleneProject): Promise<SaveResult> {
    const native = bridge()
    if (native) return native.saveProject(name, project)
    return http<SaveResult>('/api/project/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, project })
    })
  },

  async exportProject(project: MagdaleneProject): Promise<ExportResult> {
    const native = bridge()
    if (native) return native.exportProject(project)
    return http<ExportResult>('/api/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project })
    })
  },

  async openProject(): Promise<OpenResult> {
    const native = bridge()
    if (native) return native.openProject()
    return { ok: false, canceled: true }
  },

  async openAudio(): Promise<OpenAudioResult> {
    const native = bridge()
    if (!native) return { ok: false, canceled: true }
    const raw = await native.openAudio()
    if (!raw.ok || !raw.bytes) return { ok: false, canceled: raw.canceled }
    // IPC delivers the Node Buffer as a Uint8Array; hand React a clean
    // ArrayBuffer slice for decodeAudioData.
    const u8 = raw.bytes
    const buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
    return { ok: true, path: raw.path, name: raw.name, bytes: buffer, lyrics: raw.lyrics ?? null }
  },

  async scanArchive(): Promise<ScanArchiveResult> {
    const native = bridge()
    if (!native) return { ok: false, canceled: true, error: 'native only' }
    return native.scanArchive()
  },

  async analyzeAudio(filePath: string): Promise<AnalyzeAudioResult> {
    const native = bridge()
    if (!native) return { ok: false, backend: 'FFT FALLBACK' }
    return native.analyzeAudio(filePath)
  }
}
