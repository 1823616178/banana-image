import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../app/', import.meta.url))
const allowedPages = 'layout|home|gallery|detail|tasks|settings|common'
const classPattern = new RegExp(`^container_(?:${allowedPages})_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$`)
const violations = []
let checked = 0

async function vueFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await vueFiles(path))
    else if (entry.name.endsWith('.vue')) files.push(path)
  }
  return files
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length
}

function checkToken(token, file, source, index) {
  if (!token) return
  checked += 1
  if (!classPattern.test(token) && !/^is-[a-z0-9-]+$/.test(token)) {
    violations.push(`${relative(process.cwd(), file)}:${lineAt(source, index)}  ${token}`)
  }
}

for (const file of await vueFiles(root)) {
  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(/(?<![:\w-])class\s*=\s*(["'])(.*?)\1/gs)) {
    for (const token of match[2].trim().split(/\s+/)) checkToken(token, file, source, match.index)
  }
  for (const match of source.matchAll(/:class\s*=\s*(["'])(.*?)\1/gs)) {
    for (const literal of match[2].matchAll(/(["'])(.*?)\1/gs)) {
      for (const token of literal[2].trim().split(/\s+/)) checkToken(token, file, source, match.index)
    }
  }
}

if (violations.length) {
  console.error(`发现 ${violations.length} 个不合规 class：\n${violations.join('\n')}`)
  process.exitCode = 1
} else {
  console.info(`class 命名检查通过，共检查 ${checked} 个类名。`)
}
