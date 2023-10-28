import { exit } from 'process'

process.on('uncaughtException', function (err) {
    console.log('')
    console.log(err)
    console.log('')
    appExit()
})

console.clear()

import * as fs from 'fs'
import create from 'prompt-sync'
const prompt = create()
import chalk from 'chalk'
import * as childProcess from 'child_process'
const spawn = childProcess.spawn
import os from 'node:os'
import { Worker } from 'worker_threads'
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

start()
async function start() {
    boxedPrint(`Node Search ${packageJson.version}`)
    console.log('')

    console.log(chalk.yellow('What are you searching for? [case insensitive]'))
    let searchTest = prompt('')
    console.log('')
    console.log(chalk.yellow('Maximum items limit for folder search exclusion? [default = 100]'))
    let max = filterNumberInput(
        prompt(''),
        1, 99999,
        100
    )
    console.log('')
    console.log(chalk.green('List of matching elements:'))
    let drives = await getWinDrives()
    const foundCallback = function (result) {
        console.log(chalk.cyan(result))
    }
    const finishedCallback = function (results) {
        appExit()
    }
    let firstSearchTrigger = new Search(drives, searchTest, foundCallback, finishedCallback, max)
}

class Search {
    constructor(elements, patterns, resultCallback, finishCallback, maxElementsCount = 100) {
        this.matches = []
        this.workers = []
        this.tasks = 0
        this.nextWorkerCall = 0
        this.resultCallback = resultCallback
        this.finishCallback = finishCallback
        this.maxElementsCount = maxElementsCount
        this.initWorkers(patterns.toLowerCase().split(' '))
        for (const e of elements)
            this.feedWorkers(e)
    }

    initWorkers(patterns) {
        for (const core of os.cpus()) {
            this.workers.push(new Worker('./src/searchWorker.js'))
        }
        let i = 0
        for (const w of this.workers) {
            i++
            w.postMessage({
                id: i,
                maxElementsCount: this.maxElementsCount,
                patterns: patterns
            })
            w.on('message', (msg) => {
                if (msg.folders != undefined) {
                    this.countTasks(-1)
                    for (const f of msg.folders) {
                        this.feedWorkers(f)
                    }
                    if (this.searchIsFinished()) {
                        this.endSearch()
                    }
                }
                if (msg.matches != undefined) {
                    for (const m of msg.matches) {
                        this.resultCallback(m)
                        this.matches.push(m)
                    }
                }
            })
        }
    }

    feedWorkers(path) {
        this.countTasks(+1)
        this.workers[this.nextWorkerCall].postMessage({ path: path })
        this.stepWorkerCall()
    }

    stepWorkerCall() {
        this.nextWorkerCall++
        if (this.nextWorkerCall >= this.workers.length) {
            this.nextWorkerCall = 0
        }
    }

    endSearch() {
        for (let i = 0; i < this.workers.length; i++) {
            this.workers[i].terminate()
            delete this.workers[i]
        }
        this.finishCallback(this.matches)
    }

    countTasks(count) {
        this.tasks += count
    }

    searchIsFinished() {
        return this.tasks == 0
    }

}

function getWinDrives() {
    return new Promise((resolve, reject) => {
        let stdout = ''
        let stderr = ''
        let list = spawn('cmd')
        list.stdout.on('data', function (data) {
            stdout += data;
        })
        list.stderr.on('data', function (data) {
            stderr += 'stderr: ' + data
        })
        list.on('exit', function (code) {
            if (code == 0) {
                var data = stdout.split('\r\n')
                data = data.splice(4, data.length - 7)
                data = data.map(Function.prototype.call, String.prototype.trim)
                data = data.map(s => s + '//')
                resolve(data)
            } else {
                reject('get_win_drives() failed' + stderr + 'child process exited with code ' + code)
            }
        })
        list.stdin.write('wmic logicaldisk get caption\n')
        list.stdin.end()
    })
}

function appExit() {
    console.log('')
    console.log(chalk.green('We have finished.'))
    prompt(chalk.yellow('Please press enter or close this window.'))
    exit()
}

function filterNumberInput(input, min, max, defaultValue, mustBeInt = false) {
    if (input == '')
        return defaultValue
    let n = Number(input)
    if (isNaN(n))
        return defaultValue
    if (mustBeInt)
        n = Math.floor(n)
    if (n < min)
        return min
    if (n > max)
        return max
    return n
}

function boxedPrint(title) {
    const margin = 1
    const spaces = ' '.repeat(margin)
    const innerLength = title.length + margin * 2
    const line1 = `┌${'─'.repeat(innerLength)}┐`
    const line2 = `│${spaces}${title}${spaces}│`
    const line3 = `└${'─'.repeat(innerLength)}┘`
    console.log(chalk.green(line1))
    console.log(chalk.green(line2))
    console.log(chalk.green(line3))
}