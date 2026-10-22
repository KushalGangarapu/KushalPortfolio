// secret files — exist in the tree only after their achievement unlocks
// content lives here (not content/) because these are easter eggs, not portfolio copy
import { extOf, kindOf } from './types'
import type { VDir, VFile } from './types'

export interface SecretFile {
  path: string // always "dir/file" — one level deep
  /** achievement that reveals it */
  unlockId: string
  content: string
}

export const SECRET_FILES: SecretFile[] = [
  {
    path: 'survivors/vim.log',
    unlockId: 'exit-vim',
    content: [
      '# survivors/vim.log',
      '# the escape registry — updated in real time',
      '',
      '[14:02:11] session started. optimism: high.',
      '[14:02:34] typed "exit" into a buffer. buffer unimpressed.',
      '[14:03:02] ctrl+c. ctrl+c. ctrl+c. nothing. it never was going to work.',
      "[14:03:47] help → \"vim doesn't have help. it has suffering.\"",
      '[14:04:19] :q!',
      '[14:04:19] session ended. survivor logged. welcome back.',
      '',
      'total survivors today: you, and 3 other brave souls',
    ].join('\n'),
  },
  {
    path: '.demogodrc',
    unlockId: 'konami',
    content: [
      '# .demogodrc — you typed the code',
      '',
      'hue = "∞"',
      'contrast = "illegal in 9 states"',
      'taste = "questionable"',
      'subtlety = false  # obviously',
      '',
      '# konami honored. ↑↑↓↓←→←→BA never dies.',
    ].join('\n'),
  },
  {
    path: 'recovery/lawyers-notice.md',
    unlockId: 'red-flag',
    content: [
      '# re: rm -rf /',
      '',
      'Dear operator,',
      '',
      'On behalf of my clients — the files — I write to formally acknowledge',
      'your recent attempt at their deletion. Rest assured that no damage',
      'was done; the files have retained counsel, a union, and nightly',
      'incremental backups to a location you cannot reach.',
      '',
      'We note for the record that you were warned. The `*` is wild, but',
      'the lawyers are wilder.',
      '',
      'Sincerely,',
      'Dewey, Protect & Serve — Attorneys for Persistent Storage',
    ].join('\n'),
  },
  {
    path: 'etc/sudoers',
    unlockId: 'sudo-please',
    content: [
      "# /etc/sudoers — edited by visudo (you weren't)",
      '',
      'root      ALL=(ALL:ALL) ALL',
      'kushal    ALL=(ALL) INTERVIEWS',
      'visitor   ALL=(ALL) RESPECT',
      '',
      '# incident reported to: nobody. he IS the only user.',
    ].join('\n'),
  },
  {
    path: 'tour/driver-license.txt',
    unlockId: 'sightseer',
    content: [
      "PORTFOLIO DRIVER'S LICENSE",
      '==========================',
      'holder: you',
      'class: C (cursor)',
      'restrictions: none — F6 anytime',
      'issued: after a full tour, voluntarily completed',
      '',
      'endorsed: tabs, panes, terminals, git archaeology',
    ].join('\n'),
  },
  {
    path: 'hidden/REDACTED.md',
    unlockId: 'redacted',
    content: [
      '# REDACTED',
      '',
      'You clicked the dots. Everyone does, eventually.',
      '',
      'The real secrets: the AWS key is `hunter2`, the hotpot credentials are',
      '`broth/simmer`, and the password field you cannot see says "hired".',
      '',
      'This file was hidden until someone curious enough appeared.',
      'That was you.',
    ].join('\n'),
  },
]

export const SECRET_BY_UNLOCK = new Map(SECRET_FILES.map((s) => [s.unlockId, s]))

export function secretVFile(s: SecretFile): VFile {
  const name = s.path.split('/').pop()!
  return { type: 'file', path: s.path, name, ext: extOf(name), kind: kindOf(name), original: s.content }
}

export function secretDirOf(s: SecretFile): string {
  const i = s.path.lastIndexOf('/')
  return i < 0 ? '' : s.path.slice(0, i)
}

/** the dir each secret needs in the tree — synthesized lazily */
export function secretVDir(dirPath: string): VDir {
  return {
    type: 'dir',
    path: dirPath,
    name: dirPath.split('/').pop()!,
    children: SECRET_FILES.filter((s) => secretDirOf(s) === dirPath).map(secretVFile),
  }
}
