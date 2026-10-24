// 가짜 CLI 본체. 셸 심(.cmd / sh)이 `node fake-cli.mjs <이름> <인자...>`로 부른다.
// 부른 명령을 FAKE_CLI_LOG에 한 줄씩 남기고, FAKE_CLI_RESPONSES의 응답을 낸다.
import { appendFileSync, existsSync, readFileSync } from 'node:fs'

const [name, ...args] = process.argv.slice(2)
const key = [name, ...args].join(' ')
appendFileSync(process.env.FAKE_CLI_LOG, `${JSON.stringify(key)}\n`)
const file = process.env.FAKE_CLI_RESPONSES
const responses = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
const r = responses[key] ?? { out: '', code: 0 }
process.stdout.write(r.out ?? '')
process.exit(r.code ?? 0)
