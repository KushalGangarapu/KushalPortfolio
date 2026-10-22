import { extOf, kindOf } from './types'
import type { VDir, VFile, VNode } from './types'
import { DEFAULT_SETTINGS, settingsToJson } from '../settings/model'

import readme from '../../content/README.md?raw'
import changelog from '../../content/CHANGELOG.md?raw'
import kushalrc from '../../content/.kushalrc?raw'
import gitignore from '../../content/.gitignore?raw'
import contactEnv from '../../content/contact.env?raw'
import experienceJson from '../../content/experience.json?raw'
import skillsToml from '../../content/skills.toml?raw'
import packageJson from '../../content/package.json?raw'
import license from '../../content/LICENSE?raw'
import hireableTest from '../../content/tests/hireable.test.ts?raw'
import wildcatCalendar from '../../content/projects/wildcat-calendar.md?raw'
import bcssNewspaper from '../../content/projects/bcss-newspaper.md?raw'
import faithfulFlight from '../../content/projects/faithful-flight.md?raw'
import reverseCaptcha from '../../content/projects/reverse-captcha.md?raw'
import sidequests from '../../content/projects/sidequests.md?raw'
import uploadNote from '../../content/notes/the-upload-that-couldnt-touch-the-server.md?raw'
import kushalMan from '../../content/man1/kushal.1?raw'
import personTs from '../../content/src/person.ts?raw'
import contributing from '../../content/CONTRIBUTING.md?raw'
import resumeSchema from '../../content/resume.schema.json?raw'
import hireableWorkflow from '../../content/.github/workflows/hireable.yml?raw'

function file(path: string, original: string, url?: string): VFile {
  const name = path.split('/').pop()!
  return { type: 'file', path, name, ext: extOf(name), kind: kindOf(name), original, url }
}

function dir(path: string, children: VNode[]): VDir {
  const name = path.split('/').pop()!
  return { type: 'dir', path, name, children }
}

// The workspace. This tree is the portfolio — order matters.
export const ROOT: VDir = dir('', [
  file('README.md', readme),
  file('CHANGELOG.md', changelog),
  file('.kushalrc', kushalrc),
  file('.gitignore', gitignore),
  dir('projects', [
    file('projects/wildcat-calendar.md', wildcatCalendar),
    file('projects/bcss-newspaper.md', bcssNewspaper),
    file('projects/faithful-flight.md', faithfulFlight),
    file('projects/reverse-captcha.md', reverseCaptcha),
    file('projects/sidequests.md', sidequests),
  ]),
  dir('notes', [file('notes/the-upload-that-couldnt-touch-the-server.md', uploadNote)]),
  file('experience.json', experienceJson),
  file('skills.toml', skillsToml),
  file('package.json', packageJson),
  file('LICENSE', license),
  file('CONTRIBUTING.md', contributing),
  dir('tests', [file('tests/hireable.test.ts', hireableTest)]),
  dir('src', [file('src/person.ts', personTs)]),
  file('contact.env', contactEnv),
  file('resume.schema.json', resumeSchema),
  file('settings.json', settingsToJson(DEFAULT_SETTINGS)),
  file('resume.pdf', '# binary file — preview only', '/resume.pdf'),
  dir('certs', [
    file('certs/cs50ai-harvard.pdf', '# binary file — preview only', '/certs/cs50ai-harvard.pdf'),
    file('certs/fullstack-open-helsinki.png', '# binary file — preview only', '/certs/fullstack-open-helsinki.png'),
    file('certs/math-for-ml-linear-algebra.pdf', '# binary file — preview only', '/certs/math-for-ml-linear-algebra.pdf'),
  ]),
  dir('renders', [
    file('renders/wildcat.png', '# image — open in preview', '/renders/wildcat.png'),
    file('renders/wildcat.svg', '# svg — open in preview', '/renders/wildcat.svg'),
  ]),
  dir('man1', [file('man1/kushal.1', kushalMan)]),
  dir('.github', [dir('.github/workflows', [file('.github/workflows/hireable.yml', hireableWorkflow)])]),
])
